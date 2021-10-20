import { Injectable, Logger } from "@nestjs/common";
import simpleGit, {SimpleGit, SimpleGitOptions} from 'simple-git';
import { TokenAssets } from "src/endpoints/tokens/entities/token.assets";
import { Constants } from "src/utils/constants";
import { FileUtils } from "src/utils/file.utils";
import { ApiConfigService } from "./api.config.service";
import { CachingService } from "./caching.service";
const rimraf = require("rimraf");
const path = require('path');
const fs = require('fs');

@Injectable()
export class TokenAssetService {
  private readonly logger: Logger;

  constructor(
    private readonly cachingService: CachingService,
    private readonly apiConfigService: ApiConfigService,
  ) {
    this.logger = new Logger(TokenAssetService.name);
  }

  async checkout() {
    const localGitPath = 'dist/repos/assets';
    const logger = this.logger;
    rimraf(localGitPath, function () {
      logger.log('done deleting');

      const options: Partial<SimpleGitOptions> = {
        baseDir: process.cwd(),
        binary: 'git',
        maxConcurrentProcesses: 6,
      };

      // when setting all options in a single object
      const git: SimpleGit = simpleGit(options);

      git
        .outputHandler((_, stdout, stderr) => {
          stdout.pipe(process.stdout);
          stderr.pipe(process.stderr);

          stdout.on('data', (data) => {
            // Print data
            logger.log(data.toString('utf8'));
          });
        })
        .clone('https://github.com/ElrondNetwork/assets.git', localGitPath);
    });
  }

  private readAssetDetails(
    tokenIdentifier: string,
    assetPath: string,
  ): TokenAssets {
    const jsonPath = path.join(assetPath, 'info.json');
    const jsonContents = fs.readFileSync(jsonPath);
    const json = JSON.parse(jsonContents);

    return {
      website: json.website,
      description: json.description,
      status: json.status,
      pngUrl: this.getImageUrl(tokenIdentifier, 'logo.png'),
      svgUrl: this.getImageUrl(tokenIdentifier, 'logo.svg'),
    };
  }

  private getImageUrl(tokenIdentifier: string, name: string) {
    return `${this.apiConfigService.getExternalMediaUrl()}/tokens/asset/${tokenIdentifier}/${name}`;
  }

  private getTokensPath() {
    return path.join(
      process.cwd(),
      'dist/repos/assets',
      this.getTokensRelativePath(),
    );
  }

  private getTokensRelativePath() {
    const network = this.apiConfigService.getNetwork();
    if (network !== 'mainnet') {
      return path.join(network, 'tokens');
    }

    return 'tokens';
  }

  private async readAssets() {
    // read all folders from dist/repos/assets/tokens (token identifiers)
    const tokensPath = this.getTokensPath();
    if (!fs.existsSync(tokensPath)) {
      return await this.cachingService.setCache('tokenAssets', {}, Constants.oneDay());
    }

    const tokenIdentifiers = FileUtils.getDirectories(tokensPath);

    // for every folder, create a TokenAssets entity with the contents of info.json and the urls from github
    const assets: { [key: string]: TokenAssets } = {};
    for (const tokenIdentifier of tokenIdentifiers) {
      const tokenPath = path.join(tokensPath, tokenIdentifier);
      assets[tokenIdentifier] = this.readAssetDetails(
        tokenIdentifier,
        tokenPath,
      );
    }

    // create a dictionary with the being the token identifier and the value the TokenAssets entity and store it in the cache
    return await this.cachingService.setCache('tokenAssets', assets, Constants.oneDay());
  }

  private async getOrReadAssets() {
    let assets = await this.cachingService.getCache<{ [key: string] : TokenAssets }>('tokenAssets');
    if (!assets) {
      assets = await this.readAssets();
    }

    return assets;
  }

  async getAssets(tokenIdentifier: string): Promise<TokenAssets> {
    // get the dictionary from the local cache
    const assets = await this.getOrReadAssets();

    // if the tokenIdentifier key exists in the dictionary, return the associated value, else undefined
    return assets[tokenIdentifier];
  }
}
