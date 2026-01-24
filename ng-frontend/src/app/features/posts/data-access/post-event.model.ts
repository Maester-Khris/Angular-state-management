export type InteractionType = 'PREVIEW' | 'VIEW' | 'FAVORITE' | 'SHARE';

export interface PostEvent{
    postId: string;
    type: InteractionType;
    timestamp: number;
    metadata?: any;
}

export interface EventBatch{
    events: PostEvent[];
    batchId: string;
    sentAt: number;
}