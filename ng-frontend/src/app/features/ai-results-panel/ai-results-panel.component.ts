import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AiSearchResponse } from '../../core/services/remote-api';

export type AiResultsState =
    | { state: 'idle' }
    | { state: 'loading' }
    | { state: 'loaded'; data: AiSearchResponse }
    | { state: 'error'; message: string };

@Component({
    selector: 'app-ai-results-panel',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [CommonModule],
    templateUrl: './ai-results-panel.component.html',
    styleUrl: './ai-results-panel.component.scss'
})
export class AiResultsPanelComponent {
    @Input() aiState: AiResultsState = { state: 'idle' };
    @Output() docSelected = new EventEmitter<string>();

    onDocClick(uuid: string) {
        this.docSelected.emit(uuid);
    }
}
