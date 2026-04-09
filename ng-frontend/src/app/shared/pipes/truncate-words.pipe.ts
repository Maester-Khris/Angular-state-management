import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'truncateWords', standalone: true, pure: true })
export class TruncateWordsPipe implements PipeTransform {
  transform(value: string, maxWords: number): string {
    if (!value) return '';
    const words = value.split(/\s+/).filter(Boolean);
    if (words.length <= maxWords) return value;
    return words.slice(0, maxWords).join(' ') + '…';
  }
}
