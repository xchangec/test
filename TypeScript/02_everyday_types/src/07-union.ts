function printId(id: number | string | string[]) {
    if (typeof id === 'string') {
        console.log(id.toUpperCase());
    } else {
        console.log(id);
    }
}
printId(123)
printId('321')
printId(['a', 'b'])

export {}