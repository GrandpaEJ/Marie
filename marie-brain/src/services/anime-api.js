import { fetch } from 'undici';
const PROVIDERS = {
    WAIFU_PICS: 'https://api.waifu.pics',
    NEKOS_BEST: 'https://nekos.best/api/v2',
    NEKOS_LIFE: 'https://nekos.life/api/v2',
    NEKOS_API: 'https://api.nekosapi.com/v4'
};
class AnimeImageService {
    async getImage(type = 'sfw', category = 'waifu') {
        // 1. Try Waifu.pics
        try {
            const res = await fetch(`${PROVIDERS.WAIFU_PICS}/${type}/${category}`, { signal: AbortSignal.timeout(3000) });
            const data = await res.json();
            if (data.url)
                return { url: data.url, source: 'waifu.pics' };
        }
        catch (e) {
            console.warn('Waifu.pics failed:', e.message);
        }
        // 2. Try Nekos.best (SFW only)
        if (type === 'sfw') {
            try {
                const res = await fetch(`${PROVIDERS.NEKOS_BEST}/${category}`, { signal: AbortSignal.timeout(3000) });
                const data = await res.json();
                if (data.results?.[0]?.url)
                    return { url: data.results[0].url, source: 'nekos.best' };
            }
            catch (e) {
                console.warn('Nekos.best failed:', e.message);
            }
        }
        // 3. Try Nekos.life (SFW only)
        if (type === 'sfw') {
            try {
                const res = await fetch(`${PROVIDERS.NEKOS_LIFE}/img/${category}`, { signal: AbortSignal.timeout(3000) });
                const data = await res.json();
                if (data.url)
                    return { url: data.url, source: 'nekos.life' };
            }
            catch (e) {
                console.warn('Nekos.life failed:', e.message);
            }
        }
        // 4. Try NekosAPI
        try {
            const res = await fetch(`${PROVIDERS.NEKOS_API}/images/random`, { signal: AbortSignal.timeout(3000) });
            const data = await res.json();
            if (data.url)
                return { url: data.url, source: 'nekosapi.com' };
        }
        catch (e) {
            console.warn('NekosAPI failed:', e.message);
        }
        throw new Error('All anime image providers failed or category not found.');
    }
}
export default new AnimeImageService();
