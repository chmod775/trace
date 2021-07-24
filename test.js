const fs = require('fs');
// returns a window with a document and an svg root node
const { createSVGWindow } = require('svgdom')
const window = createSVGWindow()
const document = window.document
const { SVG, registerWindow } = require('@svgdotjs/svg.js')

// register window and document
registerWindow(window, document)

// create canvas
const canvas = new SVG()

// use svg.js as normal
canvas.rect(100, 100).fill('yellow').move(50,50)

// get your svg as string
console.log(canvas.svg())
fs.writeFileSync('test.svg', canvas.svg());


// create canvas
const cansas = new SVG()

// use svg.js as normal
cansas.rect(50, 100).fill('green').move(50,50)
cansas.rect(50, 100).fill('red').move(150,50)

// get your svg as string
console.log(cansas)
fs.writeFileSync('test_2.svg', cansas.svg());