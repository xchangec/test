import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseInterceptors, UploadedFiles } from '@nestjs/common';
import { PersonService } from './person.service';
import { CreatePersonDto } from './dto/create-person.dto';
import { UpdatePersonDto } from './dto/update-person.dto';
import { AnyFilesInterceptor } from '@nestjs/platform-express';

// @Controller('person')
// export class PersonController {
//   constructor(private readonly personService: PersonService) {}

//   @Post()
//   create(@Body() createPersonDto: CreatePersonDto) {
//     return this.personService.create(createPersonDto);
//   }

//   @Get()
//   findAll() {
//     return this.personService.findAll();
//   }

//   @Get(':id')
//   findOne(@Param('id') id: string) {
//     return this.personService.findOne(+id);
//   }

//   @Patch(':id')
//   update(@Param('id') id: string, @Body() updatePersonDto: UpdatePersonDto) {
//     return this.personService.update(+id, updatePersonDto);
//   }

//   @Delete(':id')
//   remove(@Param('id') id: string) {
//     return this.personService.remove(+id);
//   }
// }

@Controller('api/person')
export class PersonController {
  constructor() { }

  //query
  // find 的路由要放到 :id 的路由前面，因为 Nest 是从上往下匹配的，如果放在后面，那就匹配到 :id 的路由了
  @Get('find')
  query(@Query('name') name: string, @Query('age') age: number) {
    return `received:name=${name},age=${age}`;
  }

  // url param
  @Get(':id')
  urlParam(@Param('id') id: string) {
    return `id为: id=${id}`
  }

  // form urlencoded \ json
  @Post()
  body(@Body() createPersonDto: CreatePersonDto) {
    return `信息: ${JSON.stringify(createPersonDto)}`
  }

  @Post('file')
  @UseInterceptors(AnyFilesInterceptor({
    dest: 'uploads/'
  }))
  body2(@Body() createPersonDto: CreatePersonDto, @UploadedFiles() files: Array<Express.Multer.File>) {
    console.log(files);
    return `内容${JSON.stringify(createPersonDto)}`
  }

}
