export async function onRequest(context) {
    const { request } = context;
    const url = new URL(request.url);
    const youtubeUrl = url.searchParams.get('url');

    // ALWAYS include these headers so the browser doesn't panic
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
    };

    try {
        if (!youtubeUrl) {
            return new Response(JSON.stringify({ error: 'URL is required' }), { status: 400, headers });
        }

        // Extract Video ID
        let videoId = '';
        const match = youtubeUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|v\/))([\w-]{11})/);
        if (match) videoId = match[1];
        
        if (!videoId) {
            return new Response(JSON.stringify({ error: 'Invalid YouTube URL' }), { status: 400, headers });
        }

        // Fetch YouTube page with a fake browser identity to bypass blocks
        const pageResponse = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept-Language': 'en-US,en;q=0.9'
            }
        });

        if (!pageResponse.ok) {
            return new Response(JSON.stringify({ error: 'YouTube blocked the server (Try another video)' }), { status: 500, headers });
        }

        const pageHtml = await pageResponse.text();

        // Find caption tracks in the HTML
        const captionRegex = /"captionTracks":(\[.*?\])/;
        const captionMatch = pageHtml.match(captionRegex);

        if (!captionMatch) {
            return new Response(JSON.stringify({ error: 'No transcript found for this video' }), { status: 404, headers });
        }

        const tracks = JSON.parse(captionMatch[1]);
        if (tracks.length === 0) {
            return new Response(JSON.stringify({ error: 'No subtitles available for this video' }), { status: 404, headers });
        }

        // Fetch the actual transcript text
        const transcriptUrl = tracks[0].baseUrl + '&fmt=json3';
        const transcriptResponse = await fetch(transcriptUrl);
        
        if (!transcriptResponse.ok) {
            return new Response(JSON.stringify({ error: 'Failed to download transcript' }), { status: 500, headers });
        }

        const transcriptData = await transcriptResponse.json();

        // Clean up the data
        const transcript = transcriptData.events
            .filter(event => event.segs)
            .map(event => ({
                text: event.segs.map(seg => seg.utf8).join(''),
                start: event.start / 1000
            }));

        return new Response(JSON.stringify({ transcript }), { headers });

    } catch (error) {
        // If ANYTHING crashes, return a proper error message instead of breaking
        return new Response(JSON.stringify({ error: 'Server Error: ' + error.message }), { status: 500, headers });
    }
}
