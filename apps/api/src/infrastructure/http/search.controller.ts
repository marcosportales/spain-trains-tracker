import { BadRequestException, Controller, Get, Inject, Query } from '@nestjs/common';
import type { SearchResult } from '@stt/contracts';
import { z } from 'zod';
import {
  SEARCH_MIN_QUERY_LENGTH,
  SearchCatalog,
} from '../../application/search/search-catalog.use-case.js';

const SearchQuery = z.strictObject({
  q: z.string().trim().min(SEARCH_MIN_QUERY_LENGTH),
});

@Controller('search')
export class SearchController {
  constructor(@Inject(SearchCatalog) private readonly searchCatalog: SearchCatalog) {}

  @Get()
  search(@Query() rawQuery: unknown): Promise<SearchResult> {
    const query = SearchQuery.safeParse(rawQuery);
    if (!query.success) throw new BadRequestException(z.prettifyError(query.error));
    return this.searchCatalog.execute(query.data.q);
  }
}
