import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'app-empty-state',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './empty-state.html',
    styleUrl: './empty-state.css',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmptyStateComponent {
    @Input({ required: true }) isAvailable: boolean = true;
    @Input({ required: true }) hasNoPosts: boolean = false;
    @Input({ required: true }) isLoading: boolean = false;

    @Output() retry = new EventEmitter<void>();

    onRetry() {
        this.retry.emit();
    }
}
