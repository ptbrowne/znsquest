const Handlebars = require('handlebars')
const fs = require('fs')
const path = require('path')
const argparse = require('argparse')
const keyBy = require('lodash/keyBy')
const mapValues = require('lodash/mapValues')
const deburr = require('lodash/deburr')
const capitalize = require('lodash/capitalize')
const sortBy = require('lodash/sortBy')
const uniqueBy = require('lodash/uniqBy')
const imageSize = require('image-size')
const maxBy = require('lodash/maxBy')



const TEMPLATE_PATH = './template.html'
const IMAGES_PATH = '/Users/pbrowne/montages/znsquest/resized-photos'
const INFO_PATH = '/Users/pbrowne/Dropbox/DOCMOMO/Idées.txt'

const titlecase = str => str.split(' ').map(capitalize).join(' ')
const indexTpl = Handlebars.compile(fs.readFileSync(TEMPLATE_PATH).toString())

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
  'malus': '#E23279',
  'power': '#F9F046'
}

const colorByTypes = {
  'ami': '#111111',
  'bonus': '#111111',
  'défi': '#F9F046',
  'malus': '#111111',
  'power': '#111111'
}


const parseDescriptionLine = line => {
  const [nb, ...rest] = line.split('.')
  if (!rest) { return }
  const splitted = rest.join('.').split('|')
  const type = trim(splitted[0])
  const description = trim(splitted[2])
  return {
    number: nb,
    backgroundColor: bgByTypes[type.toLowerCase()],
    fontColor: colorByTypes[type.toLowerCase()],
    type: type,
    title: titlecase(deburr(trim(splitted[1]))),
    description
  }
}


const readCardData = () => {
  const infos = fs.readFileSync(INFO_PATH).toString().split('\n')
  const i = infos.findIndex(x => x.includes('--  DEBUT  DES  CARTES  --'))
  const splitted = infos.slice(i + 1).filter(x => trim(x) != '')
  const lines = splitted.map(parseDescriptionLine).filter(x => x && x.title && x.description)
  return lines
}

const ratio = size => size.width / size.height

const addImageData = data => {
  const imageFilepath = imageByNumber[data.number]
  const size = imageFilepath ? imageSize(imageFilepath) : {}
  const imageData = imageFilepath && readImageBase64(imageFilepath)
  return {
    ...data,
    base64Image: imageData,
    dontPreserve: size ? Math.abs(1 - ratio(size)) < 0.1 : false,
  }
}

const makeSvg = svgTplData => {
  const svgTpl = Handlebars.compile(svgTplData)
  return (data, i) => {
    return svgTpl({
      ...data,
      i
    })
  }
}

const renderHTMLPage = (data, svgTplData) => {
  const svgs = data.map(makeSvg(svgTplData))
  return indexTpl({ svgs })
}

const parseLineAlready = line => {
  const splitted = line.split(' || ')
  return {
    number: parseInt(splitted[0], 10),
    planche: splitted[1],
    title: splitted[2]
  }
}

const dumpLineAlready = obj => {
  return `${obj.number} || ${obj.planche} || ${obj.title}`
}

const loadAlready = alreadyFilename => {
  const already = fs.existsSync(alreadyFilename)
    ? fs.readFileSync(alreadyFilename)
      .toString()
      .split('\n')
      .map(parseLineAlready)
      .filter(x => !isNaN(x.number))
   : []
  return keyBy(already, x => x.number)
}

const filterImage = already => datum => {
  if (!datum.base64Image) {
    console.log('Missing photo for ', datum.number, datum.title)
  } else if (!datum.backgroundColor) {
    console.log('Bad type', datum.type, 'for', datum.number, datum.title)
  } else if (already[datum.number]) {
    // console.log('Already existing', datum.number, datum.title)
  } else {
    return true
  }
}

const renderHTMLBoards = (svgs, already, outputDir, svgTplData) => {
  const perPage = 16
  const maxPageAlready = parseInt((maxBy(Object.values(already), x => parseInt(x.planche, 10)) || {}).planche || 0, 10)
  const nbPages = Math.ceil(svgs.length / perPage)
  for (let i = 0; i < nbPages; i++) {
    const nbPlanche =  i + maxPageAlready + 1
    const svgsPlanche = svgs.slice(i*perPage, i*perPage + perPage)
    svgsPlanche.forEach(svg => {
      svg.planche = nbPlanche
    })
    const page = renderHTMLPage(svgs.slice(i*perPage, i*perPage + perPage), svgTplData)
    const plancheName = `${outputDir}/index${nbPlanche}.html`
    console.log('Generated planche', plancheName)
    fs.writeFileSync(plancheName, page)
  }
}

const generateNormalCards = svgTplData => {
  const alreadyFilename = 'already.txt'
  const already = loadAlready(alreadyFilename)
  const data = readCardData()
  const allSvgs = data.map(addImageData)
  const svgs = allSvgs.filter(filterImage(already))

  console.log(`Already done ${Object.values(already).length}/${allSvgs.length}`)
  console.log('To generate', svgs.length)

  renderHTMLBoards(svgs, already, 'pages', svgTplData)

  const newAlready = 
    sortBy(uniqueBy(svgs.concat(Object.values(already)), x => x.number), x => (
      [parseInt(x.planche, 10), parseInt(x.number, 10)]
    ))
    .filter(x => !isNaN(x.number))
    .map(dumpLineAlready)

  fs.writeFileSync(alreadyFilename, newAlready.join('\n'))
}

const generateFriendsCard = () => {
  const data = fs.readdirSync('./potes').filter(x => x.includes('.jpg')).map(filename => {
    const name = filename.replace('.jpg', '').replace('Pote | ', '')
    const imageFilepath = path.join('./potes', filename)
    const size = imageFilepath ? imageSize(imageFilepath) : {}
    const imageData = imageFilepath && readImageBase64(imageFilepath)
    return {
      title: name,
      backgroundColor: '#F9F046',
      fontColor: '#00BE91',
      base64Image: imageData,
      dontPreserve: size ? Math.abs(0.75 - ratio(size)) < 0.1 : false,
    }
  })
  const already = loadAlready('already-friends.txt')
  const friendsSvgTplData = fs.readFileSync('./card-friend.svg').toString()
  renderHTMLBoards(data, already, 'pages-friends', friendsSvgTplData)
}

const main = async () => {
  const parser = new argparse.ArgumentParser()
  parser.addArgument('svgTemplate', { defaultValue: 'card-v2.svg'})
  parser.addArgument('--friends', { action: 'storeTrue'})
  const args = parser.parseArgs()

  if (!args.friends) {
    const svgTplData = fs.readFileSync(args.svgTemplate).toString()
    generateNormalCards(svgTplData)
  } else {
    const svgTplData = fs.readFileSync(args.svgTemplate).toString()
    generateFriendsCard()
  }
}


if (require.main === module) {
  main().catch(e => {
    console.error(e)
    process.exit(1)
  })
}
