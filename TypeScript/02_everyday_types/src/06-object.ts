function printName(obj: { first: string, last?: string }) {
    console.log(`name:${obj.first}${obj?.last?.toUpperCase()}`);
}
printName({
    first: 'x',
    last: 'c'
})