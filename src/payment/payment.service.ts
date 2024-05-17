import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { User } from 'src/user/entities/user.entity';
import { AddCreditCardDto } from './dto/add-credit-card.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Card } from './entities/card.entity';
import { Repository } from 'typeorm';
import { ParkingTransactionService } from 'src/parking-transaction/parking-transaction.service';
import { ParkingTransaction } from 'src/parking-transaction/entities/parking-transaction.entity';

@Injectable()
export class PaymentService {
  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(Card) private readonly cardRepository: Repository<Card>,
    private readonly parkingTransactionService: ParkingTransactionService,
  ) {}

  async pay(user: User) {
    const paymentUrl = 'https://api.portone.io';
    const paymentId = crypto.randomUUID();
    const card = await this.cardRepository.findOne({
      where: { user: { id: user.id } },
    });
    if (!card) {
      throw new NotFoundException('Credit card not found');
    }
    const unPaidParkingTransaction =
      await this.parkingTransactionService.findUnpaidParkingTransactions(user);

    if (!unPaidParkingTransaction) {
      throw new NotFoundException('No unpaid parking transaction');
    }

    const exitTime = new Date();

    const parkingAmount = this.calculateParkingAmount(
      unPaidParkingTransaction,
      exitTime,
    );

    const totalAmount = unPaidParkingTransaction
      ? parkingAmount + unPaidParkingTransaction.chargeAmount
      : parkingAmount;

    if (totalAmount >= 100) {
      await axios.post(
        `${paymentUrl}/payments/${paymentId}/instant`,
        {
          channelKey: this.configService.get('PORTONE_CHANNEL_KEY'),
          orderName: '주차장 정산',
          amount: {
            total: totalAmount,
          },
          currency: 'KRW',
          method: {
            card: {
              credential: {
                number: card.number,
                expiryMonth: card.expiryMonth,
                expiryYear: card.expiryYear,
              },
            },
          },
          customer: {
            name: {
              full: user.name,
            },
          },
          productType: 'DIGITAL',
        },
        {
          headers: {
            Authorization: `PortOne ${this.configService.get('PORTONE_API_SECRET')}`,
          },
        },
      );

      const result = await axios.get(`${paymentUrl}/payments/${paymentId}`, {
        headers: {
          Authorization: `PortOne ${this.configService.get('PORTONE_API_SECRET')}`,
        },
      });

      if (result.data.status === 'PAID') {
        await this.parkingTransactionService.completePayment(
          unPaidParkingTransaction,
          parkingAmount,
        );
        return result.data;
      } else
        throw new InternalServerErrorException(
          {},
          { description: result.data.status },
        );
    } else {
      return await this.parkingTransactionService.completePayment(
        unPaidParkingTransaction,
        null,
      );
    }
  }

  async addCreditCard(user: User, addCreditCardDto: AddCreditCardDto) {
    const newCard = this.cardRepository.create({
      user,
      ...addCreditCardDto,
    });

    return this.cardRepository.insert(newCard);
  }

  async getCreditCard(user: User) {
    const card = await this.cardRepository.findOne({
      where: { user: { id: user.id } },
      select: {
        id: true,
        number: true,
      },
    });

    card
      ? (card.number = `${card.number.slice(0, 4)}-XXXX-XXXX-${card.number.slice(12)}`)
      : undefined;

    return card;
  }

  deleteCreditCard(user: User) {
    return this.cardRepository.delete({ user: { id: user.id } });
  }

  private calculateParkingAmount(
    parkingTransaction: ParkingTransaction,
    exitTime: Date,
  ): number {
    const parkingTimeInMilliseconds =
      exitTime.getTime() - parkingTransaction.entryTime.getTime();
    const parkingTimeInMinutes = parkingTimeInMilliseconds / 1000 / 60;

    return Math.floor(parkingTimeInMinutes * 100);
  }
}
