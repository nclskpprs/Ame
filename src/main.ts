import { mount } from 'svelte';
import App from './App.svelte';
import { setLocale } from '$lib/i18n';
import { settings } from '$lib/stores/settings.svelte';

await settings.load();
await setLocale(settings.value.locale);

const target = document.getElementById('app');
if (!target) throw new Error('missing #app element');

export default mount(App, { target });
