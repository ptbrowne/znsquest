const Handlebars = require('handlebars')
const fs = require('fs')
const path = require('path')
const argparse = require('argparse')
const keyBy = require('lodash/keyBy')
const mapValues = require('lodash/mapValues')
const deburr = require('lodash/deburr')
const capitalize = require('lodash/capitalize')

const titlecase = str => str.split(' ').map(capitalize).join(' ')

const indexTpl = Handlebars.compile(fs.readFileSync('./template.html').toString())

const IMAGES_PATH = '/Users/pbrowne/Dropbox/DOCMOMO/Photos'
const nbRx = /^(\d+)\./
const numberedImages = fs.readdirSync(IMAGES_PATH).filter(filename => nbRx.test(filename))
const imageByNumber = mapValues(
  keyBy(numberedImages, filename => {
    const m = filename.match(nbRx)
    if (m) { return m[1]}
  }),
  filename => path.join(IMAGES_PATH, filename)
)

function base64Encode(file) {
  // read binary data
  var bitmap = fs.readFileSync(file);
  // convert binary data to base64 encoded string
  return new Buffer(bitmap).toString('base64');
}

const readImageBase64 = filepath => {
  return base64Encode(filepath)
}

const lineRx = /(\d+\.)([a-z\s]+)|([a-z\s]+)|([a-z\s]+)/i
const trim = str => str && str.replace(/^\s+/g, '').replace(/\s+$/g, '')

const bgByTypes = {
  'ami': '#E2BD52',
  'bonus': '#26E2B5',
  'défi': '#410157',
  'malus': '#E23279'
}

const colorByTypes = {
  'ami': '#111111',
  'bonus': '#111111',
  'défi': '#F9F046',
  'malus': '#111111'
}


const parseDescriptionLine = line => {
  const [nb, rest] = line.split('.', 2)
  if (!rest) { return }
  const splitted = rest.split('|')
  const type = trim(splitted[0])
  return {
    number: nb,
    backgroundColor: bgByTypes[type.toLowerCase()],
    fontColor: colorByTypes[type.toLowerCase()],
    type: type,
    title: titlecase(deburr(trim(splitted[1]))),
    description: trim(splitted[2])
  }
}


const readCardData = () => {
  const infos = fs.readFileSync('/Users/pbrowne/Dropbox/DOCMOMO/Idées.txt').toString().split('\n')
  const i = infos.findIndex(x => x.includes('--  DEBUT  DES  CARTES  --'))
  const splitted = infos.slice(i + 1).filter(x => trim(x) != '')
  const lines = splitted.map(parseDescriptionLine).filter(x => x && x.title && x.description)
  return lines
}

const makeSvg = svgTplData => {
  const svgTpl = Handlebars.compile(svgTplData)
  return (data, i) => {
    const imageFilepath = imageByNumber[data.number]
    return svgTpl({
      ...data,
      base64Image: imageFilepath && readImageBase64(imageFilepath),
      i
    })
  }
}

const main = async () => {
  const parser = new argparse.ArgumentParser()
  parser.addArgument('svgTemplate', { defaultValue: 'card-v2.svg'})
  const args = parser.parseArgs()
  const data = readCardData()
  const svgTplData = fs.readFileSync(args.svgTemplate).toString()
  const svgs = data.map(makeSvg(svgTplData))
  const index = indexTpl({ svgs })
  fs.writeFileSync('index.html', index)
}

if (require.main === module) {
  main().catch(e => {
    console.error(e)
    process.exit(1)
  })
}
