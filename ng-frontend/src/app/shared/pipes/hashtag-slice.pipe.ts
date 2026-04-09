import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'hashtagSlice', standalone: true, pure: true })
export class HashtagSlicePipe implements PipeTransform {
  transform(tags: string[], max: number): { visible: string[]; overflow: number } {
    if (!tags?.length) return { visible: [], overflow: 0 };
    return {
      visible: tags.slice(0, max),
      overflow: Math.max(0, tags.length - max),
    };
  }
}
