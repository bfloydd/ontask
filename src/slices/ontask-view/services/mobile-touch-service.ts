import { ContextMenuService } from './context-menu-service';

export interface MobileTouchServiceInterface {
	addMobileTouchHandlers(element: HTMLElement, task: any): void;
}

export class MobileTouchService implements MobileTouchServiceInterface {
	private contextMenuService: ContextMenuService;

	constructor(contextMenuService: ContextMenuService) {
		this.contextMenuService = contextMenuService;
	}

	addMobileTouchHandlers(element: HTMLElement, task: any): void {
		let touchStartTime: number = 0;
		let touchStartX: number = 0;
		let touchStartY: number = 0;
		let longPressTimer: number | null = null;
		let hasMoved: boolean = false;
		const LONG_PRESS_DURATION = 500; // 500ms for long press
		const MOVE_THRESHOLD = 10; // 10px movement threshold

		element.addEventListener('touchstart', (e) => {
			touchStartTime = Date.now();
			touchStartX = e.touches[0].clientX;
			touchStartY = e.touches[0].clientY;
			hasMoved = false;

			longPressTimer = window.setTimeout(() => {
				if (!hasMoved) {
					const touch = e.touches[0];
					const mouseEvent = new MouseEvent('contextmenu', {
						clientX: touch.clientX,
						clientY: touch.clientY,
						bubbles: true,
						cancelable: true
					});
					this.contextMenuService.showContextMenu(mouseEvent, task);
				}
			}, LONG_PRESS_DURATION);
		}, { passive: true });

		element.addEventListener('touchmove', (e) => {
			if (longPressTimer) {
				const currentX = e.touches[0].clientX;
				const currentY = e.touches[0].clientY;
				const deltaX = Math.abs(currentX - touchStartX);
				const deltaY = Math.abs(currentY - touchStartY);

				if (deltaX > MOVE_THRESHOLD || deltaY > MOVE_THRESHOLD) {
					hasMoved = true;
					if (longPressTimer) {
						clearTimeout(longPressTimer);
						longPressTimer = null;
					}
				}
			}
		}, { passive: true });

		element.addEventListener('touchend', (e) => {
			if (longPressTimer) {
				clearTimeout(longPressTimer);
				longPressTimer = null;
			}
		}, { passive: true });

		element.addEventListener('touchcancel', (e) => {
			if (longPressTimer) {
				clearTimeout(longPressTimer);
				longPressTimer = null;
			}
		}, { passive: true });
	}
}
