import linksData from '@/data/externalLinks.json';

export class LinksService {
  static getAllLinks() {
    return linksData.links;
  }
}
