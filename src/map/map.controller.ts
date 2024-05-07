import { MapService } from './map.service';
import { Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import { ParkService } from '../park/park.service';
import { MapBodyDto } from './dto/map.dto';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { addrDto } from './dto/addr.dto';
import { ParkInfoDto } from './dto/parkInfo.dto';

@Controller('map')
@ApiTags('지도')
export class MapController {
  constructor(
    private readonly parkService: ParkService,
    private readonly mapService: MapService,
  ) {}

  @Get()
  @HttpCode(200)
  @ApiOperation({ summary: '주차장 반환' })
  async findByLocation(@Query() query: MapBodyDto) {
    const pcgData = await this.parkService.findByLocation(query.lat, query.lng);
    const publicData = await this.mapService.getPublicPark(query);
    return { pcg: pcgData, public: publicData };
  }

  @Get('addr')
  @HttpCode(200)
  @ApiOperation({ summary: '주소 to 위경도' })
  async addrToLatLng(@Query() query: addrDto) {
    return await this.mapService.addrToLatLng(query.addr);
  }

  @Get('park')
  @ApiOperation({ summary: '주차장 상세 정보 반환' })
  async getParkInfo(@Query() query: ParkInfoDto) {
    return await this.mapService.getParkInfo(query.name);
  }
}
