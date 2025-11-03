import { App } from 'obsidian';
import { EventSystem } from '../../events';

export interface ScrollToTopServiceInterface {
	initialize(contentEl: HTMLElement): void;
	destroy(): void;
}

export class ScrollToTopService implements ScrollToTopServiceInterface {
	private eventSystem: EventSystem;
	private app: App;
	private contentEl: HTMLElement | null = null;
	private scrollToTopButton: HTMLButtonElement | null = null;
	private scrollThreshold: number = 100; // Show button after scrolling 100px down
	private isVisible: boolean = false;
	private scrollHandler: (() => void) | null = null;
	private scrollContainer: HTMLElement | null = null;
	private usingWindowScroll = false;

	constructor(eventSystem: EventSystem, app: App) {
		this.eventSystem = eventSystem;
		this.app = app;
	}

	initialize(contentEl: HTMLElement): void {
		this.contentEl = contentEl;
		this.createScrollToTopButton();
		this.setupScrollListener();
		
		// Check initial scroll position
		this.handleScroll();
	}

	private createScrollToTopButton(): void {
		if (!this.contentEl) return;

		// Create the scroll-to-top button
		this.scrollToTopButton = document.createElement('button');
		this.scrollToTopButton.className = 'ontask-scroll-to-top-button';
		
		// Use DOM API instead of innerHTML for security
		const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
		svg.setAttribute('class', 'lucide lucide-chevron-up');
		svg.setAttribute('width', '16');
		svg.setAttribute('height', '16');
		svg.setAttribute('viewBox', '0 0 24 24');
		svg.setAttribute('fill', 'none');
		svg.setAttribute('stroke', 'currentColor');
		svg.setAttribute('stroke-width', '2');
		svg.setAttribute('stroke-linecap', 'round');
		svg.setAttribute('stroke-linejoin', 'round');
		
		const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
		path.setAttribute('d', 'm18 15-6-6-6 6');
		svg.appendChild(path);
		
		this.scrollToTopButton.appendChild(svg);
		this.scrollToTopButton.title = 'Scroll to top';
		this.scrollToTopButton.setAttribute('aria-label', 'Scroll to top');

		// Add click handler
		this.scrollToTopButton.addEventListener('click', () => {
			this.scrollToTop();
		}, { passive: true });

		// Add touch support for mobile
		this.scrollToTopButton.addEventListener('touchstart', (e) => {
			e.preventDefault();
			this.scrollToTop();
		}, { passive: false });

		// Initially hide the button
		this.scrollToTopButton.classList.add('ontask-scroll-hidden');

		// Append to the content element
		this.contentEl.appendChild(this.scrollToTopButton);
	}

	private setupScrollListener(): void {
		this.scrollHandler = () => {
			this.handleScroll();
		};

		let container: HTMLElement | null = null;

		if (this.contentEl) {
			const leaf = this.contentEl.closest('.workspace-leaf-content') as HTMLElement | null;
			const viewContent = leaf?.querySelector<HTMLElement>('.view-content');
			container = viewContent?.contains(this.contentEl) ? viewContent : leaf;
		}

		if (!container) {
			container = document.querySelector('.workspace-leaf.mod-active .workspace-leaf-content') as HTMLElement | null;
		}

		if (container) {
			this.scrollContainer = container;
			container.addEventListener('scroll', this.scrollHandler, { passive: true });
		} else {
			this.usingWindowScroll = true;
			window.addEventListener('scroll', this.scrollHandler, { passive: true });
		}
	}

	private handleScroll(): void {
		if (!this.scrollToTopButton) return;

		let scrollTop = 0;

		if (this.scrollContainer) {
			scrollTop = this.scrollContainer.scrollTop;
		} else if (this.usingWindowScroll) {
			scrollTop = window.scrollY || document.documentElement.scrollTop;
		}

		const shouldShow = scrollTop > this.scrollThreshold;

		if (shouldShow && !this.isVisible) {
			this.showButton();
		} else if (!shouldShow && this.isVisible) {
			this.hideButton();
		}
	}

	private showButton(): void {
		if (!this.scrollToTopButton) return;

		this.isVisible = true;
		this.scrollToTopButton.classList.remove('ontask-scroll-hidden');
		this.scrollToTopButton.classList.add('ontask-scroll-visible');
		
		// Use requestAnimationFrame for smooth animation
		requestAnimationFrame(() => {
			if (this.scrollToTopButton) {
				this.scrollToTopButton.classList.add('ontask-scroll-animated');
			}
		});
	}

	private hideButton(): void {
		if (!this.scrollToTopButton) return;

		this.isVisible = false;
		this.scrollToTopButton.classList.remove('ontask-scroll-visible', 'ontask-scroll-animated');
		this.scrollToTopButton.classList.add('ontask-scroll-hiding');
		
		// Hide the button after animation completes
		setTimeout(() => {
			if (this.scrollToTopButton && !this.isVisible) {
				this.scrollToTopButton.classList.add('ontask-scroll-hidden');
				this.scrollToTopButton.classList.remove('ontask-scroll-hiding');
			}
		}, 200);
	}

	private scrollToTop(): void {
		if (this.scrollContainer) {
			if (typeof this.scrollContainer.scrollTo === 'function') {
				this.scrollContainer.scrollTo({
					top: 0,
					behavior: 'smooth'
				});
			} else {
				this.scrollContainer.scrollTop = 0;
			}
		}

		if (this.usingWindowScroll) {
			window.scrollTo({
				top: 0,
				behavior: 'smooth'
			});
		}
	}

	destroy(): void {
		if (this.scrollHandler) {
			if (this.scrollContainer) {
				this.scrollContainer.removeEventListener('scroll', this.scrollHandler);
			}
			if (this.usingWindowScroll) {
				window.removeEventListener('scroll', this.scrollHandler);
			}
		}

		this.scrollContainer = null;
		this.usingWindowScroll = false;

		// Remove button from DOM
		if (this.scrollToTopButton && this.scrollToTopButton.parentNode) {
			this.scrollToTopButton.parentNode.removeChild(this.scrollToTopButton);
		}

		// Clean up references
		this.contentEl = null;
		this.scrollToTopButton = null;
		this.scrollHandler = null;
		this.isVisible = false;
	}
}

