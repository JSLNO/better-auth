import { createFetch } from "@better-fetch/fetch";
import { getBaseURL } from "../utils/url";
import { type Atom } from "nanostores";
import type { AtomListener, ClientOptions } from "./types";
import { addCurrentURL, addOrigin, redirectPlugin } from "./fetch-plugins";

export const getClientConfig = <O extends ClientOptions>(options?: O) => {
	/* check if the credentials property is supported. Useful for cf workers */
	const isCredentialsSupported = "credentials" in Request.prototype;
	const baseURL = getBaseURL(
		options?.fetchOptions?.baseURL || options?.baseURL,
	);
	/* set the origin header to the baseURL if it exists. this is useful for non browser environments */
	const origin = baseURL ? new URL(baseURL).origin : undefined;
	const $fetch = createFetch({
		baseURL,
		...(isCredentialsSupported ? { credentials: "include" } : {}),
		method: "GET",
		...options?.fetchOptions,
		plugins: options?.disableDefaultFetchPlugins
			? options.fetchOptions?.plugins
			: [
					redirectPlugin,
					addOrigin,
					addCurrentURL,
					...(options?.fetchOptions?.plugins?.filter(
						(pl) => pl !== undefined,
					) || []),
					...(options?.plugins
						?.flatMap((plugin) => plugin.fetchPlugins)
						.filter((pl) => pl !== undefined) || []),
				],
	});

	const plugins = options?.plugins || [];
	let pluginsActions = {} as Record<string, any>;
	let pluginsAtoms = {} as Record<string, Atom<any>>;
	let pluginPathMethods: Record<string, "POST" | "GET"> = {
		"/sign-out": "POST",
		"/user/revoke-sessions": "POST",
	};
	const atomListeners: AtomListener[] = [
		{
			signal: "_sessionSignal",
			matcher(path) {
				return (
					path === "/sign-out" ||
					path === "/user/update" ||
					path.startsWith("/sign-in") ||
					path.startsWith("/sign-up")
				);
			},
		},
	];
	for (const plugin of plugins) {
		if (plugin.getActions) {
			Object.assign(pluginsActions, plugin.getActions?.($fetch));
		}
		if (plugin.getAtoms) {
			Object.assign(pluginsAtoms, plugin.getAtoms?.($fetch));
		}
		if (plugin.pathMethods) {
			Object.assign(pluginPathMethods, plugin.pathMethods);
		}
		if (plugin.atomListeners) {
			atomListeners.push(...plugin.atomListeners);
		}
	}
	return {
		pluginsActions,
		pluginsAtoms,
		pluginPathMethods,
		atomListeners,
		$fetch,
	};
};
