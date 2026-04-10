export interface WriterPost {
  uuid:         string;
  title:        string;
  description:  string;
  hashtags:     string[];
  images:       string[];
  status:       'draft' | 'published';
  lastEditedAt: string;
  publishedAt?: string;
  views?:       number;
  readTime?:    number;
  authorName:   string;
  authorAvatar?: string;
}

export interface WriterStats {
  totalPosts:     number;
  totalDrafts:    number;
  totalPublished: number;
}
