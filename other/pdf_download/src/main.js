const express = require('express');
const path = require('path')
const fs = require('fs')

const app = express()

app.use('/static', express.static(path.join(__dirname, '../public')));

app.get('/', (req, res, next) => {
    res.sendFile(path.join(__dirname, '../index.html'))
})
app.get('/file', (req, res, next) => {
    // res.set({
    //     "Content-type": "application/octet-stream",
    //     "Content-Disposition": "attachment;filename=test_2.pdf"
    // });
    fs.readFile(path.join(__dirname, '../public/sql.pdf'), (err, data) => {
        // console.log(data);
        // 二进制流转base64
        let str = Buffer.from(data, 'binary').toString('base64')
        res.send(str)
    })
    // res.
})
app.listen(3000, () => {
    console.log('server runing at port 3000');
})