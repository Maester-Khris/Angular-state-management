import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
    selector: 'app-hero',
    standalone: true,
    imports: [RouterLink],
    templateUrl: './hero.html',
    styleUrl: './hero.css',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeroComponent {
    scrollToCommunity() {
        const element = document.getElementById('community-post');
        if (element) {
            element.scrollIntoView({ behavior: 'smooth' });
        }
    }
}
