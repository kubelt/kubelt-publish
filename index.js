const fs = require('fs')
const util = require('util')

const core = require('@actions/core')
const fetch = require('node-fetch')
const sha256 = require('@stablelib/sha256')
const FormData = require('form-data')

const glob = util.promisify(require('glob'))
const exec = util.promisify(require('child_process').exec)

async function start() {
    try {
        const secret = core.getInput('secret', { required: true })
        const globspec = core.getInput('glob', { required: true })
        // Restrict the "as" parameter to either "dag" or "file".
        const as = (core.getInput('as', { required: false }).match("^dag$|^file$") || ['dag'])[0]
        const published = core.getBooleanInput('published', { required: false }) || false

        const roots = await glob(globspec).then(async files => {
            const roots = []
            for (let i = 0; i < files.length; i++) {
                
                const metadata = JSON.stringify({
                    "published": published,
                    "as": as,
                })

                const form = new FormData()

                if ("dag" == as) {
                    // TODO: Make this call via SDK instead of CLI.
                    // TODO: Check failure to pack.
                    const { stdin, stdout } = await exec(`node ${__dirname}/vendor/cli.js courtyard convert ${files[i]}`)
                    //options.body = fs.createReadStream('./output.car')
                    form.append('data', fs.createReadStream('./output.car'))
                } else { // "file" == as
                    //options.body = fs.createReadStream(files[i])
                    form.append('data', fs.createReadStream(files[i]))
                }

                const options = {
                    method: 'POST',
                    headers: { // TODO 'Content-Type'?
                        ...form.headers,
                        'X-Metadata': metadata, // TODO: Check failure to encode.
                        'X-Public-Key': secret,
                        'X-Signature': secret, // Generate from key (sig of pubkey).
                    },
                }

                options.body = form
 
                // TODO: Calculate the name so we can build it into the URL.
                const name = Buffer.from(sha256.hash(secret + files[i])).toString('hex')

                // TODO: Figure out how to make work with `act` for local dev.
                //const url = new URL(name, 'http://127.0.0.1:8787/v0/api/content/kbt/')
                const url = new URL(name, 'https://api.pndo.xyz/v0/api/content/kbt/')
                //console.log(url)

                // Push the CID into the roots list.
                responseBody = await fetch(url, options).then(response => response.json())
                responseBody.metadata.box.name = `/kbt/${name}`
                //console.log(responseBody)
                roots.push(responseBody)
            }
            return roots
        })
        core.setOutput('roots', roots)
    } catch (e) {
        core.setFailed(e.message)
        throw e
    }
}

start()
