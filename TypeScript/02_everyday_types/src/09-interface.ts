interface Point {
    x: number,
    y: number
}

interface Animal {
    name: string
}
interface Bear extends Animal {
    honey: boolean
}

// type Animal = {
//     name: string
// }
// type Bear = Animal & {
//     honey: boolean
// }

const bear: Bear = {
    name: 'winie',
    honey: true
}
console.log(bear.name);

export { }