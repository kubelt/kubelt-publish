// For generating our own keys:
const crypto = require('libp2p-crypto')

// For calculating content names:
const PeerId = require('peer-id')
const { CID } = require('multiformats/cid')
const { base36 } = require('multiformats/bases/base36')

// For HTTP comms:
const fetch = require('node-fetch')
const FormData = require('multi-part')

// For filesystem ops:
const fs = require('fs/promises')
const path = require('path')
const tmp = require('tmp-promise')
const util = require('util')
const glob = util.promisify(require('glob'))
const execFile = util.promisify(require('child_process').execFile)

async function getContentName(publishingKey) {
    const peer = await PeerId.createFromPrivKey(publishingKey.bytes)
    const peerId = peer.toString()
    const cid = CID.parse(peerId)
    return cid.toString(base36)
}

async function getPublishingKey(protobufKey, name) {
    // Get the key object out of the protobuf.
    const masterKeyMaterial = await crypto.keys.unmarshalPrivateKey(protobufKey)

    // Sign the human name to seed the generation of a publishing key for it.
    // TODO: Use a 32 bit hash (blake2). Plus disambiguating context.
    const signature = await masterKeyMaterial.sign(Buffer.from(name))

    // ed25519 seeds must be 32 bytes. What's the uniformity of entropy?
    const seedStartIndex = 0
    const seedLength = 32
    const seed = signature.slice(seedStartIndex, seedLength)

    // Return a 2048 bit ed25519 keypair with the above seed.
    const algo = 'ed25519'
    const bitwidth = 2048
    return crypto.keys.generateKeyPairFromSeed(algo, seed, bitwidth)
}

function getHumanName(namespec, filepath) {
    let name = ''
    // TODO: Currently namespec is only expected to be "path". Add other specs.
    // TODO: Should probably done inline with the "as" parameter handling.
    switch (namespec) {
        case "path":
            // Get the filename at the end of the passed path.
            const namebase = path.basename(filepath)
            // Strip off the extension if it exists. TODO: Remove?
            //const ext = namebase.lastIndexOf('.')
            name = namebase//ext < 0 ? namebase : namebase.substring(0, ext)
        break
        default:
            throw(`Unexpected namespec ${namespec}. Should be 'path'.`)
    }
    return name
}

// Sanitize the "as" input parameter.
function getAs(as) {
    // Restrict the "as" parameter to either "dag", "file", "dir", or "wrap".
    // Default to "dag".
    const sanitized_as = as || ''
    return (sanitized_as.match("^dag$|^file$|^dir$|^wrap$") || ['dag'])[0]
}

async function isValidSpec(as, filepath) {
    try {
        const inodeStat = await fs.lstat(filepath)

        // We're being asked to pack a dag or a file and are passed a file.
        const validFileSpec = ("dag" == as || "file" == as) && inodeStat.isFile()

        // We're being asked to pack a directory and are passed a directory.
        const validDirSpec = ("dir" == as || "wrap" == as) && inodeStat.isDirectory()

        // Either of the above statements is true.
        return validFileSpec || validDirSpec
    } catch (e) {
        return false
    }
}

async function getDAGForm(form, filepath) {
    let tempfile = null
    return tmp.file().then(f => {
            tempfile = f
            return execFile('node', [path.join(__dirname, 'vendor', 'cli.js'), 'courtyard', 'convert', filepath, '--out-file', tempfile.path])
        })
        .then(async () => fs.open(tempfile.path))
        .then(async (fd) => {
            form.append('data', fd.createReadStream())
        })
}

async function getFileForm(form, filepath) {
    return fs.open(filepath)
        .then(async fd => {
            form.append('data', fd.createReadStream())
        })
}

async function getDirectoryForm(form, filepath, wrapDirectory) {
    let tempfile = null
    return tmp.file().then(f => {
            tempfile = f
            return execFile('node', [path.join(__dirname, 'node_modules', 'ipfs-car', 'dist', 'cjs', 'cli', 'cli.js'), '--pack', filepath, '--output', tempfile.path, '--wrapWithDirectory', wrapDirectory])
        })
        .then(async () => fs.open(tempfile.path))
        .then(async (fd) => {
            form.append('data', fd.createReadStream())
        })
}

async function getForm(form, as, filepath) {
    return isValidSpec(as, filepath)
        .then(valid => {
            if (!valid) {
                throw ('Invalid as/file pairing:', as, filepath)
            }

            switch (as) {
                case "dag": {
                    return getDAGForm(form, filepath)
                }
                case "file": {
                    return getFileForm(form, filepath)
                }
                case "dir":
                case "wrap": {
                    const wrapDirectory = "wrap" == as
                    return getDirectoryForm(form, filepath, wrapDirectory)
                }
                default: {
                    throw ('Invalid "as" parameter: ', as)
                }
            }
        })
}

async function start(secret, globspec, namespec, published, as, limit = -1, endpoint = 'https://api.pndo.xyz') {
    return glob(globspec).then(async files => {
        const limiter = limit < 0 ? files.length : limit
        const requestMap = files.slice(0, limiter).map(async file => {
            const humanName = getHumanName(namespec, file)
            const publishingKey = await getPublishingKey(Buffer.from(secret, 'base64'), humanName)
            const contentName = await getContentName(publishingKey)

            // TODO: Should be publishing key?
            const protocolPubKey = crypto.keys.marshalPublicKey(publishingKey)
            const encodedPubKey = protocolPubKey.toString('base64')

            const form = new FormData()
            await getForm(form, as, file)

            const options = {
                method: 'POST',
                headers: {
                    ...form.getHeaders(),
                    'X-Metadata': JSON.stringify({
                        'published': published,
                        'human': humanName,
                        'path': file,
                        'as': as,
                    }),
                    //'X-Public-Key': encodedPubKey, // TODO: publishing key?
                    'X-Signature': encodedPubKey, // TODO: publishing key?
                },
            }
            options.body = form.stream()

            const url = new URL(contentName, new URL('/v0/api/content/kbt/', endpoint))
            console.log(url+'')
            return fetch(url, options).then(response => response.json())
        })

        return Promise.all(requestMap)
    })
}

module.exports = {
    getContentName,
    getPublishingKey,
    getHumanName,
    getAs,
    isValidSpec,
    getDAGForm,
    getFileForm,
    getDirectoryForm,
    getForm,
    start,
}
