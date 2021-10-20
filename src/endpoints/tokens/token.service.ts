import { Injectable, Logger } from "@nestjs/common";
import { Token } from "./entities/token";
import { TokenWithBalance } from "./entities/token.with.balance";
import { TokenDetailed } from "./entities/token.detailed";
import { TokenAssetService } from "src/common/token.asset.service";
import { QueryPagination } from "src/common/entities/query.pagination";
import { ApiUtils } from "src/utils/api.utils";
import { TokenFilter } from "./entities/token.filter";
import { TokenUtils } from "src/utils/tokens.utils";
import { EsdtService } from "src/common/esdt.service";

@Injectable()
export class TokenService {
  private readonly logger: Logger;

  constructor(
    private readonly tokenAssetService: TokenAssetService,
    private readonly esdtService: EsdtService,
  ) {
    this.logger = new Logger(TokenService.name);
  }

  async getToken(identifier: string): Promise<TokenDetailed | undefined> {
    let tokens = await this.esdtService.getAllEsdtTokens();
    let token = tokens.find(x => x.identifier === identifier);
    if (token) {
      token.assets = await this.tokenAssetService.getAssets(token.identifier);

      return ApiUtils.mergeObjects(new TokenDetailed(), token);
    }

    return undefined;
  }

  async getTokens(queryPagination: QueryPagination, filter: TokenFilter): Promise<TokenDetailed[]> {
    const { from, size } = queryPagination;

    let tokens = await this.getFilteredTokens(filter);

    tokens = tokens.slice(from, from + size);

    for (const token of tokens) {
      token.assets = await this.tokenAssetService.getAssets(token.identifier);
    }

    return tokens.map((item) =>
      ApiUtils.mergeObjects(new TokenDetailed(), item),
    );
  }

  async getFilteredTokens(filter: TokenFilter): Promise<TokenDetailed[]> {
    let tokens = await this.esdtService.getAllEsdtTokens();

    if (filter.search) {
      let searchLower = filter.search.toLowerCase();

      tokens = tokens.filter(
        (token) =>
          token.name.toLowerCase().includes(searchLower) ||
          token.identifier.toLowerCase().includes(searchLower),
      );
    }

    if (filter.name) {
      let nameLower = filter.name.toLowerCase();

      tokens = tokens.filter(token => token.name.toLowerCase().includes(nameLower));
    }

    if (filter.identifier) {
      let identifierLower = filter.identifier.toLowerCase();

      tokens = tokens.filter(token => token.identifier.toLowerCase().includes(identifierLower));
    }

    if (filter.identifiers) {
      const identifierArray = filter.identifiers.split(',').map(identifier => identifier.toLowerCase());

      tokens = tokens.filter(token => identifierArray.includes(token.identifier.toLowerCase()));
    }
    
    return tokens;
  }

  async getTokenCount(filter: TokenFilter): Promise<number> {
    let tokens = await this.getFilteredTokens(filter);

    return tokens.length;
  }

  async getTokenCountForAddress(address: string): Promise<number> {
    let tokens = await this.getAllTokensForAddress(address, new TokenFilter());
    return tokens.length;
  }

  async getTokensForAddress(address: string, queryPagination: QueryPagination, filter: TokenFilter): Promise<TokenWithBalance[]> {
    const { from, size } = queryPagination;
    
    let tokens = await this.getAllTokensForAddress(address, filter);

    tokens = tokens.slice(from, from + size);

    for (const token of tokens) {
      token.assets = await this.tokenAssetService.getAssets(token.identifier);
    }

    return tokens.map((token) =>
      ApiUtils.mergeObjects(new TokenWithBalance(), token),
    );
  }

  async getTokenForAddress(address: string, tokenIdentifier: string): Promise<TokenWithBalance | undefined> {
    let allTokens = await this.getAllTokensForAddress(address, new TokenFilter());

    const foundToken = allTokens.find((x) => x.identifier === tokenIdentifier);
    if (!foundToken) {
      return undefined;
    }

    foundToken.assets = await this.tokenAssetService.getAssets(tokenIdentifier);

    return foundToken;
  }

  async getAllTokensForAddress(address: string, filter: TokenFilter): Promise<TokenWithBalance[]> {
    let tokens = await this.getFilteredTokens(filter);

    const tokensIndexed: { [index: string]: Token } = {};
    for (const token of tokens) {
      tokensIndexed[token.identifier] = token;
    }

    let esdts = await this.esdtService.getAllEsdtsForAddress(address);

    const tokensWithBalance: TokenWithBalance[] = [];

    for (let tokenIdentifier of Object.keys(esdts)) {
      if (!TokenUtils.isEsdt(tokenIdentifier)) {
        continue;
      }

      let esdt = esdts[tokenIdentifier];
      let token = tokensIndexed[tokenIdentifier];
      if (!token) {
        this.logger.log(
          `Could not find token with identifier ${tokenIdentifier}`,
        );
        continue;
      }

      const tokenWithBalance = {
        ...token,
        ...esdt,
      };

      tokensWithBalance.push(tokenWithBalance);
    }

    for (const token of tokensWithBalance) {
      // @ts-ignore
      token.identifier = token.tokenIdentifier;
      // @ts-ignore
      delete token.tokenIdentifier;
    }

    return tokensWithBalance;
  }
}
