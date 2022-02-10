const tap = require('tap')
const lib = require('../library')

tap.test('We get the right content names', async t => {
    // This simulates what is stored in the Github Secret: a base64 encoded
    // protobuf containing a libp2p key.
    const base64_SECRET_KEY = 'CAESQNCzosaz9m4t4MQgFEuHIjicXYOLhk5Ee+/i4+AisAqR1VMaS460TQzZND3dtS0aS4f6qTYnryAWcWJfYlXWFlM='

    // This is the human-readable content name.
    const human_name = 'my_content.jpg'

    // Generate the key for that name.
    const publishing_key = await lib.getPublishingKey(Buffer.from(base64_SECRET_KEY, 'base64'), human_name)

    // Validate that the key gives us the right content name.
    const content_name = await lib.getContentName(publishing_key)
    t.equal(content_name, 'k51qzi5uqu5dgthudpht2my9zr9v80xyz9c41fylhm9kzu8rj8jt8w3ivs0d5g')
    t.end()
})

tap.test('We get valid human names', t => {
    const namespec = 'path'
    const filepath = 'alex/is/a/test/machine'
    const human_name = lib.getHumanName(namespec, filepath)
    t.equal(human_name, 'machine')
    t.end()
})

tap.test('Test the "as" parameter', t => {
    // Positive tests:
    const as_dag = 'dag'
    t.equal(as_dag, lib.getAs(as_dag))

    const as_file = 'file'
    t.equal(as_file, lib.getAs(as_file))

    const as_dir = 'dir'
    t.equal(as_dir, lib.getAs(as_dir))

    const as_wrap = 'wrap'
    t.equal(as_wrap, lib.getAs(as_wrap))

    // Negative tests:
    const as_bad = 'this_is_a_bad_as_parameter'
    t.equal(as_dag, lib.getAs(as_bad))

    const as_empty = ''
    t.equal(as_dag, lib.getAs(as_empty))

    const as_null = null
    t.equal(as_dag, lib.getAs(as_null))

    const as_undef = undefined
    t.equal(as_dag, lib.getAs(as_undef))

    t.end()
})

tap.test('Test the "isValidSpec" function', async t => {
    const as_dag = 'dag'
    const as_file = 'file'
    const as_dir = 'dir'
    const as_wrap = 'wrap'
    const filepath = './test/test.js'
    const dirpath = './test/fixtures'

    // Positive tests:
    const dag_is_file = await lib.isValidSpec(as_dag, filepath)
    t.ok(dag_is_file)

    const dag_is_dir = await lib.isValidSpec(as_dag, dirpath)
    t.notOk(dag_is_dir)

    const file_is_file = await lib.isValidSpec(as_file, filepath)
    t.ok(file_is_file)

    const file_is_dir = await lib.isValidSpec(as_file, dirpath)
    t.notOk(file_is_dir)

    const dir_is_file = await lib.isValidSpec(as_dir, filepath)
    t.notOk(dir_is_file)

    const dir_is_dir = await lib.isValidSpec(as_dir, dirpath)
    t.ok(dir_is_dir)

    const wrap_is_file = await lib.isValidSpec(as_wrap, filepath)
    t.notOk(wrap_is_file)

    const wrap_is_dir = await lib.isValidSpec(as_wrap, dirpath)
    t.ok(wrap_is_dir)

    // Negative tests:
    const as_bad = 'this_is_not_a_valid_as_spec'
    const as_null = null
    const as_undef = undefined
    const bad_filepath = ''
    const null_filepath = null
    const undef_filepath = undefined
    const bad_dirpath = ''
    const null_dirpath = null
    const undef_dirpath = undefined

    const bad_is_file = await lib.isValidSpec(as_bad, filepath)
    t.notOk(bad_is_file)

    const bad_is_dir = await lib.isValidSpec(as_bad, dirpath)
    t.notOk(bad_is_dir)

    const bad_is_badfile = await lib.isValidSpec(as_bad, bad_filepath)
    t.notOk(bad_is_badfile)

    const bad_is_baddir = await lib.isValidSpec(as_bad, bad_dirpath)
    t.notOk(bad_is_baddir)

    const bad_is_nullfile = await lib.isValidSpec(as_bad, null_filepath)
    t.notOk(bad_is_nullfile)

    const bad_is_undeffile = await lib.isValidSpec(as_bad, undef_filepath)
    t.notOk(bad_is_undeffile)

    const bad_is_nulldir = await lib.isValidSpec(as_bad, null_dirpath)
    t.notOk(bad_is_nulldir)

    const bad_is_undefdir = await lib.isValidSpec(as_bad, undef_dirpath)
    t.notOk(bad_is_undefdir)
})

tap.test('Test getDAGForm', async t => {
    const dag_fixture = './test/fixtures/unrevealed.json'
    const bad_dag_fixture = './test/fixtures/unrevealed.car'

    const form = await lib.getDAGForm(dag_fixture)
    console.log(form)

    //const form_fixture = form
    //t.match(form, form_fixture)
    //t.expectUncaughtException(await lib.getDAGForm(bad_dag_fixture))

    t.end()
})
