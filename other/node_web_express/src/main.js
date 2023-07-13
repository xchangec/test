const express = require('express')
const path = require('path')
const fs = require('fs')

const app = express()

app.use('/static', express.static(path.join(__dirname, '../public')))

app.get('*', (req, res) => {
  console.log(req.url) // 包含解析 JSON 的 JavaScript 对象
  //   res.json(req.body)
  res.send('11111')
})
// app.post('*', (req, res) => {
//   console.log(req) // 包含解析 JSON 的 JavaScript 对象
// //   res.json(req.body)
// })
app.get('/', (req, res, next) => {
  res.sendFile(path.join(__dirname, '../index.html'))
})
app.get('/test/abc', (req, res, next) => {
  res.send('11111')
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

app.post('/test/def', (req, res, next) => {
  res.send('222')
})
app.listen(3000, () => {
  console.log('server runing at port 3000')
})
