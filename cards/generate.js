// Dependendances et librairies
// Require permet d'importer une librairie
// 
const Handlebars = require('handlebars')

// Gestion des fichiers (fs = filesystem)
const fs = require('fs')

// Gestion des chemins des fichiers
const path = require('path')

// Gestion des arguments de la ligne de commande
const argparse = require('argparse')

// Fonctions utilitaires
const keyBy = require('lodash/keyBy') // indexer un tableau par une clé
const mapValues = require('lodash/mapValues') // transformer un objet via une fonction
const deburr = require('lodash/deburr') // enlever les accents 
const capitalize = require('lodash/capitalize') // mettre en capitales
const sortBy = require('lodash/sortBy') // trier
const uniqueBy = require('lodash/uniqBy') // enlever les duplicats selon une fonction
const maxBy = require('lodash/maxBy') // donner le maximum selon une fonction

// Calculer la taille d'une image
const imageSize = require('image-size')


const TEMPLATE_PATH = './template.html'
const IMAGES_PATH = '/Users/pbrowne/montages/znsquest/resized-photos'

// Idees contient toutes les descriptions des images
// dans le format
// numero. | type de carte | titre | description
// Pour chaque personne, tu devras surement rajouter des champs (| tenue à l'alcool | % d'humour | endurance)
const INFO_PATH = '/Users/pbrowne/Dropbox/DOCMOMO/Idées.txt'

// abc def ghi -> Abc Def Ghi
const titlecase = str => str.split(' ').map(capitalize).join(' ')

// Handlebars permet de gérer des templates. Des templates sont des fichiers ou
// vont être remplacées des valeurs. 
// Ex de template
// 
// const template = "Bonjour {{ nom }}"
// const compiledTemplate = Handlebars.compile(template)
// const greetingPat = compiledTemplate({ nom: "Pat" })
// "Bonjour Pat"
// const greetingPaul = compiledTemplate({ nom: "Paul" })
// "Bonjour Paul"
// 
// C'est ce qui va permettre de créer des fichiers SVG avec les valeurs pour
// chaque ligne dans le fichier des description (voir plus haut).
const indexTpl = Handlebars.compile(fs.readFileSync(TEMPLATE_PATH).toString())

const nbRx = /^(\d+)\./

// Ici je lis toutes les images qui sont dans le dossier d'images
// Le résultat est un tableau ["1. toto.jpg", "2. tata.jpg"]
// Le filter est là pour n'avoir que les fichiers qui correspondent à "<nombre>. quelquechose"
// donc il n'y aura pas par exemple "tutu.jpg" vu qu'elle n'a pas de numéro.
const numberedImages = fs.readdirSync(IMAGES_PATH).filter(filename => nbRx.test(filename))


const imageByNumber = mapValues(
  // Ici j'indexe mes images par numéro
  // ["1. toto.jpg", "2. tata.jpg"] -> { 1: '1. toto.jpg', 2: '2. toto.jpg'}
  keyBy(numberedImages, filename => {
    const m = filename.match(nbRx)
    if (m) { return m[1]}
  }),

  // Puis j'ajoute le chemin du dossier d'image pour avoir des chemins absolues
  // { 
  //   1: '/mon/dossier/ou/ya/les/images/1. toto. jpg',
  //   2: '/mon/dossier/ou/ya/les/images/2. tata.jpg'
  // }
  filename => path.join(IMAGES_PATH, filename)
)

// Dans le fichier SVG, les images sont encodées en base64
function base64Encode(file) {
  // read binary data
  var bitmap = fs.readFileSync(file);
  // convert binary data to base64 encoded string
  return new Buffer(bitmap).toString('base64');
}

const readImageBase64 = filepath => {
  return base64Encode(filepath)
}

// On rentre dans le code qui va lire le fichier de description
// et en sortir des informations structurées
// 
// lineRx est une regex, une expression régulière, cela permet de
// décrire des chaînes de caractère et d'extraire des valeurs
// 
// \d signifie un nombre
// + signifie un ou plusieurs
// 
// donc \d+ signifie un ou plusieurs nombres
// 
// [a-z] signifie "un caractère entre a et z"
// \s représente un espace
// 
// [a-z\s] veut donc dire "une lettre de l'alphabet ou un espace"
// puis le + signifie "répété plusieurs fois"
// 
// Au final la ligne décrit
// 
// numéro. type | titre | description
// 
//  C'est un peu cryptique...
const lineRx = /(\d+\.)([a-z\s]+)|([a-z\s]+)|([a-z\s]+)/i

// Enlève les espace de début et de fin de ligne
const trim = str => str && str.replace(/^\s+/g, '').replace(/\s+$/g, '')

// Les couleurs de fond pour chaque type de carte
const bgByTypes = {
  'ami': '#E2BD52',
  'bonus': '#26E2B5',
  'défi': '#410157',
  'malus': '#E23279',
  'power': '#F9F046'
}

// Les couleurs de texte pour chaque type de carte
const colorByTypes = {
  'ami': '#111111',
  'bonus': '#111111',
  'défi': '#F9F046',
  'malus': '#111111',
  'power': '#111111'
}

// Depuis une ligne de description, renvoie un object structuré qui pourra être
// passé au template
// 
// const line = "1. Défi | mange ses crottes de nez | Mange une de tes crottes de nez pour la science et avance d'1 page !"
// const res = parseDescriptionLine(line)
// {
//   number: "1",
//   backgroundColor: "#410157",
//   fontColor: "#F9F046",
//   type: "défi",
//   title: "Mange ses crottes de nez",
//   description: "Mange une de tes crottes de nez pour la science et avance d'1 page !"
// }
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

// Lit le fichier de description en entier et renvoie tout les objets structurés
// représentant les cartes
const readCardData = () => {
  const infos = fs.readFileSync(INFO_PATH).toString().split('\n')
  const i = infos.findIndex(x => x.includes('--  DEBUT  DES  CARTES  --'))
  const splitted = infos.slice(i + 1).filter(x => trim(x) != '')
  const lines = splitted.map(parseDescriptionLine).filter(x => x && x.title && x.description)
  return lines
}

// Ratio permettant de calculer le ratio d'une image
// Utilisé pour savoir si on peut étirer un peu la photo
// Sinon on n'étire pas et on utilise la photo flouté et agrandie comme fond
// cf dontPreserve plus bas
const ratio = size => size.width / size.height

// Rajoute les informations d'image aux objets structurés renvoyés par readCardData
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

// A partir d'un template, renvoie une fonction qui à
// partir d'un objet carte (renvoyé juste au dessus) renvoie une chaîne de
// caractére représentant un SVG correspondant à cette carte
const makeSvg = svgTplData => {
  const svgTpl = Handlebars.compile(svgTplData)
  return (data, i) => {
    return svgTpl({
      ...data,
      i
    })
  }
}

// Génération d'une page HTML contenant des cartes en SVG
// 
// data est les objets structurés sur lequel on itère (map) pour
// faire des SVGs qu'on passe au template HTML
const renderHTMLPage = (data, svgTplData) => {
  const svgs = data.map(makeSvg(svgTplData))
  return indexTpl({ svgs })
}

// Les 3 fonctions ci-dessous sont de la gestion d'images déjà générés, tu
// n'en a sûrement pas besoi
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

// Retourne si une carte est valide
// 
// Une carte est valide si
// 
// - elle a son image
// - son type valide (un type est valide si on
//   a une couleur de fond pour ce type)
const filterCard = (card, already) => {
  if (!card.base64Image) {
    console.log('Missing photo for ', card.number, card.title)
  } else if (!card.backgroundColor) {
    console.log('Bad type', card.type, 'for', card.number, card.title)
  } else if (already[card.number]) {
    // console.log('Already existing', card.number, card.title)
  } else {
    return true
  }
}

const renderHTMLBoards = (svgs, already, outputDir, svgTplData) => {
  // On va générer plusieurs fichiers HTML avec un maximum de 16 images par fichier
  const perPage = 16

  // On récupère le numéro de la dernière planche générée
  const maxPageAlready = parseInt((maxBy(Object.values(already), x => parseInt(x.planche, 10)) || {}).planche || 0, 10)

  // Nombre de pages à faire
  const nbPages = Math.ceil(svgs.length / perPage)
  for (let i = 0; i < nbPages; i++) {
    const nbPlanche =  i + maxPageAlready + 1
    const svgsPlanche = svgs.slice(i*perPage, i*perPage + perPage)

    // On rajoute dans chaque objet structuré la planche qui le contient
    // Sert à générer le fichier qui contient ce qui a déjà été généré.
    // On peut savoir dans quelle planche se situe quelle image. Surtout
    // utile lors de la génération lorsqu'on se rend compte qu'une image
    // n'est pas là ou pas bonne.
    svgsPlanche.forEach(svg => {
      svg.planche = nbPlanche
    })

    // Rendu de la page
    const page = renderHTMLPage(svgs.slice(i*perPage, i*perPage + perPage), svgTplData)
    
    // Nom du fichier
    const plancheName = `${outputDir}/index${nbPlanche}.html`
    console.log('Generated planche', plancheName)

    // Écriture du fichier
    fs.writeFileSync(plancheName, page)
  }
}

// Génération des cartes normales (pas les cartes amis)
const generateNormalCards = svgTplData => {
  const alreadyFilename = 'already.txt'

  // On lit le fichier qui contient les images déjà générées
  const already = loadAlready(alreadyFilename)

  // On lit le fichier de description et on en fait des infos
  // structurés
  const allCardsWithoutImageData = readCardData()

  // On rajoute les infos d'image
  const allCards = allCardsWithoutImageData.map(addImageData)

  // On ne prend que les cartes ayant une image
  const validCards = allCards.filter(card => filterCard(card, already))

  // On écrit ce qu'on a déja fait
  console.log(`Already done ${Object.values(already).length}/${allCards.length}`)
  console.log('To generate', validCards.length)

  // On génére tout
  renderHTMLBoards(validCards, already, 'pages', svgTplData)

  // On réécrit le fichier qui contient les images déjà générées
  const newAlready = 
    sortBy(uniqueBy(validCards.concat(Object.values(already)), x => x.number), x => (
      [parseInt(x.planche, 10), parseInt(x.number, 10)]
    ))
    .filter(x => !isNaN(x.number))
    .map(dumpLineAlready)
  fs.writeFileSync(alreadyFilename, newAlready.join('\n'))
}

// Les cartes amis avait une logique un peu différente, tu n'en auras sûrement
// pas besoin
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

// Fonction principale appellée au début
// 
// Un peu de logique pour qu'on puisse 
// 
// - choisir le template de carte utilisé
// - générer les cartes amis
// 
// $ node ./generate.js cards-v2.svg
// $ node ./generate.js cards-v3.svg
// $ node ./generate.js --friends card-friends.svg
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


// Lancement du programme et gestion des erreurs
if (require.main === module) {
  main().catch(e => {
    console.error(e)
    process.exit(1)
  })
}
