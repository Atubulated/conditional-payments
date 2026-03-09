import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { type, message, address } = await req.json();
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;

    if (!webhookUrl) {
      console.error("DISCORD_WEBHOOK_URL is not set in environment variables.");
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    // Setting up the Discord embed styling based on the type of feedback
    let color = 0x6366f1; // Default Indigo
    if (type === 'Bug Report') color = 0xef4444; // Red
    if (type === 'Feature Request') color = 0x10b981; // Emerald

    const embed = {
      title: `📣 New Feedback: ${type}`,
      color: color,
      fields: [
        {
          name: 'Sender Wallet',
          value: address ? `\`${address}\`` : 'Not connected',
        },
        {
          name: 'Message',
          value: message,
        },
      ],
      timestamp: new Date().toISOString(),
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [embed] }),
    });

    if (!response.ok) {
      throw new Error(`Discord API responded with ${response.status}`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Feedback Submission Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}