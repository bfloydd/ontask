// Dependency Injection slice - Service implementation
import { DIContainer, ServiceIdentifier, ServiceFactory, ServiceRegistration } from './di-container-interface';

export class DIContainerImpl implements DIContainer {
	private registrations: Map<ServiceIdentifier, ServiceRegistration> = new Map();

	register<T>(identifier: ServiceIdentifier<T>, factory: ServiceFactory<T>, singleton: boolean = true): void {
		this.registrations.set(identifier, {
			identifier,
			factory,
			singleton
		});
	}

	registerSingleton<T>(identifier: ServiceIdentifier<T>, factory: ServiceFactory<T>): void {
		this.register(identifier, factory, true);
	}

	registerTransient<T>(identifier: ServiceIdentifier<T>, factory: ServiceFactory<T>): void {
		this.register(identifier, factory, false);
	}

	resolve<T>(identifier: ServiceIdentifier<T>): T {
		const registration = this.registrations.get(identifier);
		
		if (!registration) {
			throw new Error(`Service with identifier '${String(identifier)}' is not registered`);
		}

		// Return existing instance if singleton and already created
		if (registration.singleton && registration.instance) {
			return registration.instance as T;
		}

		// Create new instance
		try {
			const instance = registration.factory(this);
			registration.instance = instance;
			return instance as T;
		} catch (error) {
			throw new Error(`Failed to create instance for '${String(identifier)}': ${error}`);
		}
	}

	isRegistered(identifier: ServiceIdentifier): boolean {
		return this.registrations.has(identifier);
	}

	getRegisteredServices(): ServiceIdentifier[] {
		return Array.from(this.registrations.keys());
	}

	clear(): void {
		this.registrations.clear();
	}
}
