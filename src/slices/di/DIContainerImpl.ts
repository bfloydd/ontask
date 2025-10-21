// Dependency injection container
import { DIContainer, ServiceIdentifier, ServiceFactory, ServiceRegistration } from './DIContainerInterface';

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


	resolve<T>(identifier: ServiceIdentifier<T>): T {
		const registration = this.registrations.get(identifier);
		
		if (!registration) {
			throw new Error(`Service with identifier '${String(identifier)}' is not registered`);
		}

		if (registration.singleton && registration.instance) {
			return registration.instance as T;
		}

		try {
			const instance = registration.factory(this);
			registration.instance = instance;
			return instance as T;
		} catch (error) {
			throw new Error(`Failed to create instance for '${String(identifier)}': ${error}`);
		}
	}


	clear(): void {
		this.registrations.clear();
	}
}
