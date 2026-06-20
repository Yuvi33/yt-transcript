export async function onRequest(context) {
    const { request } = context;
    const url = new URL(request.url);
    const youtubeUrl = url.searchParams.get('url');

    const headers = {
        'Content-Type': 'application/json'
    };

    if (!youtubeUrl) {
        return new Response(JSON.stringify({ error: 'URL is required' }), { status: 400, headers });
    }

    try {
        // Extract Video ID
        let videoId = '';
        const match = youtubeUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|v\/))([\w-]{11})/);
        if (match) videoId = match[1];
        
        if (!videoId) throw new Error('Invalid YouTube URL');

        // Fetch YouTube page
        const pageResponse = await fetch(`https://www.youtube.com/watch?v=${videoId}`);
        const pageHtml = await pageResponse.text();

        // Find caption tracks in the HTML
        const captionRegex = /"captionTracks":(\[.*?\])/;
        const captionMatch = pageHtml.match(captionRegex);

        if (!captionMatch) throw new Error('No transcript found for this video');

        const tracks = JSON.parse(captionMatch[1]);
        if (tracks.length === 0) throw new Error('No subtitles available');

        // Fetch the actual transcript text
        const transcriptUrl = tracks[0].baseUrl + '&fmt=json3';
        const transcriptResponse = await fetch(transcriptUrl);
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
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers });
    }
}
