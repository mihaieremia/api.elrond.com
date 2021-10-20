import { Test } from '@nestjs/testing';
import { PublicAppModule } from 'src/public.app.module';
import { TokenDetailed } from 'src/endpoints/tokens/entities/token.detailed';
import { TokenService } from 'src/endpoints/tokens/token.service';
import Initializer from './e2e-init';
import { Constants } from 'src/utils/constants';
import { TokenFilter } from 'src/endpoints/tokens/entities/token.filter';

describe.skip('Token Service', () => {
  let tokenService: TokenService;
  let tokenName: string;
  let tokenIdentifier: string;

  beforeAll(async () => {
    await Initializer.initialize();
  }, Constants.oneHour() * 1000);

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [PublicAppModule],
    }).compile();

    tokenService = moduleRef.get<TokenService>(TokenService);

    let tokens = await tokenService.getTokens({from: 0, size: 1}, new TokenFilter());
    expect(tokens).toHaveLength(1);

    const token = tokens[0];
    tokenName = token.name;
    tokenIdentifier = token.identifier;
  });

  describe('Tokens list', () => {
    describe('Tokens pagination', () => {
      it(`should return a list with 25 tokens`, async () => {
        const tokensList = await tokenService.getTokens({from: 0, size: 25}, new TokenFilter());

        expect(tokensList).toBeInstanceOf(Array);
        expect(tokensList).toHaveLength(25);

        for (const token of tokensList) {
          expect(token).toHaveStructure(Object.keys(new TokenDetailed()));
        }
      });

      it(`should return a list with 10 tokens`, async () => {
        const tokensList = await tokenService.getTokens({from: 0, size: 10}, new TokenFilter());
        expect(tokensList).toBeInstanceOf(Array);
        expect(tokensList).toHaveLength(10);

        for (const token of tokensList) {
          expect(token).toHaveStructure(Object.keys(new TokenDetailed()));
        }
      });
    });

    describe('Tokens filters', () => {
      it(`should return a list of tokens for a collection`, async () => {
        const tokensList = await tokenService.getTokens({from: 0, size: 50}, { name: tokenName });
        expect(tokensList).toBeInstanceOf(Array);

        for (const token of tokensList) {
          expect(token).toHaveStructure(Object.keys(new TokenDetailed()));
          expect(token.name).toBe(tokenName);
        }
      });
    });
  });

  describe('Token count', () => {
    it(`should return a number`, async () => {
      const tokensCount: Number = new Number(await tokenService.getTokenCount(new TokenFilter()));

      expect(tokensCount).toBeInstanceOf(Number);
    });
  });

  describe('Specific token', () => {
    it(`should return a token for a specific identifier`, async () => {
      const token = await tokenService.getToken(tokenIdentifier);

      if (token) {
        expect(token.identifier).toBe(tokenIdentifier);
        expect(token.name).toBe(tokenName);
      }
    });

    it(`should throw 'Token not found' error`, async () => {
      await expect(
        tokenService.getToken(tokenIdentifier + 'a'),
      ).toBeUndefined();
    });
  })
});
