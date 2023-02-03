const http = require("http");
const url = require("url"); //处理url

const server = http.createServer((req, res) => {
  //请求方式
  console.log(req.method);
  //路径、参数
  let { pathname, query } = url.parse(req.url);
  console.log(pathname, query);
  // console.log(req.headers);

  //处理post请求参数
  req.on("data", (data) => {
    console.log(data.toString());
  });

  res.statusCode = 201;
  res.statusMessage = "okk";
  //中文处理
  res.setHeader("Content-Type", "text/html;charset=utf8");
  res.end("你好!");
});
server.listen(3000, () => {
  console.log("server running at port 3000");
});
