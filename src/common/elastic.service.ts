import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { NftFilter } from 'src/endpoints/tokens/entities/nft.filter';
import { NftType } from 'src/endpoints/tokens/entities/nft.type';
import { TransactionLog } from 'src/endpoints/transactions/entities/transaction.log';
import { ApiConfigService } from './api.config.service';
import { ApiService } from './api.service';
import { buildElasticQuery } from '../utils/elastic.queries';
import { ElasticQuery } from './entities/elastic/elastic.query';
import { ElasticSortOrder } from './entities/elastic/elastic.sort.order';
import { QueryOperator } from './entities/elastic/query.operator';
import { QueryType } from './entities/elastic/query.type';

@Injectable()
export class ElasticService {
  private readonly url: string;

  constructor(
    private apiConfigService: ApiConfigService,
    @Inject(forwardRef(() => ApiService))
    private readonly apiService: ApiService,
  ) {
    this.url = apiConfigService.getElasticUrl();
  }

  async getCount(
    collection: string,
    elasticQueryAdapter: ElasticQuery | undefined = undefined,
  ) {
    const url = `${this.apiConfigService.getElasticUrl()}/${collection}/_count`;

    let elasticQuery;

    if (elasticQueryAdapter) {
      elasticQuery = buildElasticQuery(elasticQueryAdapter);
    }

    const result: any = await this.post(url, elasticQuery);
    const count = result.data.count;

    return count;
  }

  async getItem(collection: string, key: string, identifier: string) {
    const url = `${this.url}/${collection}/_doc/${identifier}`;
    const { data: document } = await this.get(url);

    return this.formatItem(document, key);
  }

  private formatItem(document: any, key: string) {
    const { _id, _source } = document;
    const item: any = {};
    item[key] = _id;

    return { ...item, ..._source };
  }

  async getList(
    collection: string,
    key: string,
    elasticQueryAdapter: ElasticQuery,
  ): Promise<any[]> {
    const url = `${this.url}/${collection}/_search`;

    const elasticQuery = buildElasticQuery(elasticQueryAdapter);

    const {
      data: {
        hits: { hits: documents },
      },
    } = await this.post(url, elasticQuery);

    return documents.map((document: any) => this.formatItem(document, key));
  }

  async getAccountEsdtByIdentifier(identifier: string) {
    const elasticQueryAdapter: ElasticQuery = new ElasticQuery();
    elasticQueryAdapter.condition.must = [
      QueryType.Match('identifier', identifier, QueryOperator.AND),
    ];

    const elasticQuery = buildElasticQuery(elasticQueryAdapter);

    const url = `${this.url}/accountsesdt/_search`;
    const documents = await this.getDocuments(url, elasticQuery);

    return documents.map((document: any) =>
      this.formatItem(document, 'identifier'),
    );
  }

  async getTokensByIdentifiers(identifiers: string[]) {
    const elasticQueryAdapter: ElasticQuery = new ElasticQuery();
    elasticQueryAdapter.condition.should = identifiers.map((identifier) =>
      QueryType.Match('identifier', identifier, QueryOperator.AND),
    );

    const elasticQuery = buildElasticQuery(elasticQueryAdapter);

    const url = `${this.url}/tokens/_search`;
    const documents = await this.getDocuments(url, elasticQuery);

    return documents.map((document: any) =>
      this.formatItem(document, 'identifier'),
    );
  }

  async getAccountEsdtByAddress(
    address: string,
    from: number,
    size: number,
    token: string | undefined,
  ) {
    const elasticQueryAdapter: ElasticQuery = new ElasticQuery();
    elasticQueryAdapter.pagination = { from, size };

    elasticQueryAdapter.condition.must = [
      QueryType.Match('address', address),
      QueryType.Exists('identifier'),
    ];

    if (token) {
      elasticQueryAdapter.condition.must.push(
        QueryType.Match('token', token, QueryOperator.AND),
      );
    }

    const elasticQuery = buildElasticQuery(elasticQueryAdapter);

    const url = `${this.url}/accountsesdt/_search`;
    const documents = await this.getDocuments(url, elasticQuery);

    return documents.map((document: any) =>
      this.formatItem(document, 'identifier'),
    );
  }

  async getAccountEsdtByAddressAndIdentifier(
    address: string,
    identifier: string,
  ) {
    const elasticQueryAdapter: ElasticQuery = new ElasticQuery();
    elasticQueryAdapter.pagination = { from: 0, size: 1 };

    elasticQueryAdapter.condition.must = [
      QueryType.Match('address', address),
      QueryType.Match('identifier', identifier, QueryOperator.AND),
    ];

    const elasticQuery = buildElasticQuery(elasticQueryAdapter);

    const url = `${this.url}/accountsesdt/_search`;
    const documents = await this.getDocuments(url, elasticQuery);

    return documents.map((document: any) =>
      this.formatItem(document, 'identifier'),
    )[0];
  }

  async getAccountEsdtByAddressCount(address: string) {
    const elasticQueryAdapter: ElasticQuery = new ElasticQuery();
    elasticQueryAdapter.pagination = { from: 0, size: 0 };

    elasticQueryAdapter.condition.must = [
      QueryType.Match('address', address),
      QueryType.Exists('identifier'),
    ];

    const elasticQuery = buildElasticQuery(elasticQueryAdapter);

    const url = `${this.url}/accountsesdt/_search`;
    return await this.getDocumentCount(url, elasticQuery);
  }

  private buildElasticNftFilter(
    from: number,
    size: number,
    filter: NftFilter,
    identifier: string | undefined,
  ) {
    const elasticQueryAdapter: ElasticQuery = new ElasticQuery();
    elasticQueryAdapter.pagination = { from, size };
    elasticQueryAdapter.sort = [
      { name: 'timestamp', order: ElasticSortOrder.descending },
    ];

    const queries = [];
    queries.push(QueryType.Exists('identifier'));

    if (filter.search !== undefined) {
      queries.push(QueryType.Wildcard('token', `*${filter.search}*`));
    }

    if (filter.type !== undefined) {
      queries.push(QueryType.Match('type', filter.type));
    }

    if (identifier !== undefined) {
      queries.push(
        QueryType.Match('identifier', identifier, QueryOperator.AND),
      );
    }

    if (filter.collection !== undefined) {
      queries.push(
        QueryType.Match('token', filter.collection, QueryOperator.AND),
      );
    }

    if (filter.hasUris !== undefined) {
      queries.push(
        QueryType.Nested('data', { 'data.nonEmptyURIs': filter.hasUris }),
      );
    }

    if (filter.tags) {
      const tagArray = filter.tags.split(',');
      if (tagArray.length > 0) {
        for (const tag of tagArray) {
          queries.push(QueryType.Nested('data', { 'data.tags': tag }));
        }
      }
    }

    if (filter.creator !== undefined) {
      queries.push(
        QueryType.Nested('data', { 'data.creator': filter.creator }),
      );
    }

    elasticQueryAdapter.condition.must = queries;

    const elasticQuery = buildElasticQuery(elasticQueryAdapter);

    return elasticQuery;
  }

  async getTokens(
    from: number,
    size: number,
    filter: NftFilter,
    identifier: string | undefined,
  ) {
    const query = await this.buildElasticNftFilter(
      from,
      size,
      filter,
      identifier,
    );

    const url = `${this.url}/tokens/_search`;
    const documents = await this.getDocuments(url, query);

    return documents.map((document: any) =>
      this.formatItem(document, 'identifier'),
    );
  }

  async getTokenCollectionCount(
    search: string | undefined,
    type: NftType | undefined,
  ) {
    const elasticQueryAdapter: ElasticQuery = new ElasticQuery();
    elasticQueryAdapter.pagination = { from: 0, size: 0 };
    elasticQueryAdapter.sort = [
      { name: 'timestamp', order: ElasticSortOrder.descending },
    ];

    const mustNotQueries = [];
    mustNotQueries.push(QueryType.Exists('identifier'));

    elasticQueryAdapter.condition.must_not = mustNotQueries;

    const mustQueries = [];
    if (search !== undefined) {
      mustQueries.push(QueryType.Wildcard('token', `*${search}*`));
    }

    if (type !== undefined) {
      mustQueries.push(QueryType.Match('type', type));
    }
    elasticQueryAdapter.condition.must = mustQueries;

    const shouldQueries = [];
    shouldQueries.push(QueryType.Match('type', NftType.SemiFungibleESDT));
    shouldQueries.push(QueryType.Match('type', NftType.NonFungibleESDT));
    elasticQueryAdapter.condition.should = shouldQueries;

    const elasticQuery = buildElasticQuery(elasticQueryAdapter);

    const url = `${this.url}/tokens/_search`;
    return await this.getDocumentCount(url, elasticQuery);
  }

  async getTokenCollections(
    from: number,
    size: number,
    search: string | undefined,
    type: NftType | undefined,
    token: string | undefined,
    issuer: string | undefined,
    identifiers: string[],
  ) {
    const elasticQueryAdapter: ElasticQuery = new ElasticQuery();
    elasticQueryAdapter.pagination = { from, size };
    elasticQueryAdapter.sort = [
      { name: 'timestamp', order: ElasticSortOrder.descending },
    ];

    const mustNotQueries = [];
    mustNotQueries.push(QueryType.Exists('identifier'));
    elasticQueryAdapter.condition.must_not = mustNotQueries;

    const mustQueries = [];
    if (search !== undefined) {
      mustQueries.push(QueryType.Wildcard('token', `*${search}*`));
    }

    if (type !== undefined) {
      mustQueries.push(QueryType.Match('type', type));
    }

    if (token !== undefined) {
      mustQueries.push(QueryType.Match('token', token, QueryOperator.AND));
    }

    if (issuer !== undefined) {
      mustQueries.push(QueryType.Match('issuer', issuer));
    }
    elasticQueryAdapter.condition.must = mustQueries;

    const shouldQueries = [];

    if (identifiers.length > 0) {
      for (const identifier of identifiers) {
        shouldQueries.push(
          QueryType.Match('token', identifier, QueryOperator.AND),
        );
      }
    } else {
      shouldQueries.push(QueryType.Match('type', NftType.SemiFungibleESDT));
      shouldQueries.push(QueryType.Match('type', NftType.NonFungibleESDT));
    }
    elasticQueryAdapter.condition.should = shouldQueries;

    const elasticQuery = buildElasticQuery(elasticQueryAdapter);

    const url = `${this.url}/tokens/_search`;
    const documents = await this.getDocuments(url, elasticQuery);

    return documents.map((document: any) =>
      this.formatItem(document, 'identifier'),
    );
  }

  async getTokenByIdentifier(identifier: string) {
    const elasticQueryAdapter: ElasticQuery = new ElasticQuery();
    elasticQueryAdapter.pagination = { from: 0, size: 1 };
    elasticQueryAdapter.sort = [
      { name: 'timestamp', order: ElasticSortOrder.descending },
    ];

    elasticQueryAdapter.condition.must = [
      QueryType.Exists('identifier'),
      QueryType.Match('identifier', identifier, QueryOperator.AND),
    ];

    const elasticQuery = buildElasticQuery(elasticQueryAdapter);

    const url = `${this.url}/tokens/_search`;
    const documents = await this.getDocuments(url, elasticQuery);

    return documents.map((document: any) =>
      this.formatItem(document, 'identifier'),
    )[0];
  }

  async getTokenCount(filter: NftFilter): Promise<number> {
    const query = await this.buildElasticNftFilter(0, 0, filter, undefined);

    const url = `${this.url}/tokens/_search`;
    return await this.getDocumentCount(url, query);
  }

  async getLogsForTransactionHashes(
    elasticQueryAdapter: ElasticQuery,
  ): Promise<TransactionLog[]> {
    const elasticQuery = buildElasticQuery(elasticQueryAdapter);

    const url = `${this.url}/logs/_search`;
    return await this.getDocuments(url, elasticQuery);
  }

  public async get(url: string) {
    return await this.apiService.get(url);
  }

  private async post(url: string, body: any) {
    return await this.apiService.post(url, body);
  }

  private async getDocuments(url: string, body: any) {
    const {
      data: {
        hits: { hits: documents },
      },
    } = await this.post(url, body);

    return documents;
  }

  private async getDocumentCount(url: string, body: any) {
    const {
      data: {
        hits: {
          total: { value },
        },
      },
    } = await this.post(url, body);

    return value;
  }
}
