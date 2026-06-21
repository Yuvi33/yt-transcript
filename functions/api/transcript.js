export async function onRequest(context) {
    const { request } = context;
    const url = new URL(request.url);
    const youtubeUrl = url.searchParams.get('url');

    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
    };

    try {
        if (!youtubeUrl) throw new Error('YouTube URL is required');

        let videoId = '';
        const match = youtubeUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|v\/))([\w-]{11})/);
        if (match) videoId = match[1];
        if (!videoId) throw new Error('Invalid YouTube URL');

        // Fetch YouTube page
        const pageResponse = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept-Language': 'en-US,en;q=0.9'
            }
        });

        const html = await pageResponse.text();

        // Find caption URL
        const captionRegex = /"captionTracks"[\s\S]*?"baseUrl":"(.*?)"/;
        const captionMatch = html.match(captionRegex);

        if (!captionMatch) throw new Error('No transcript found. The video might not have subtitles (CC).');

        let transcriptUrl = captionMatch[1].replace(/\\u0026/g, '&');
        transcriptUrl += '&fmt=json3';

        // Fetch transcript text
        const transcriptResponse = await fetch(transcriptUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });

        const transcriptData = await transcriptResponse.json();

        const transcript = transcriptData.events
            .filter(event => event.segs)
            .map(event => ({
                text: event.segs.map(seg => seg.utf8).join(''),
                start: event.start / 1000
            }));

        return new Response(JSON.stringify({ transcript }), { headers });

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers });
    }
}
