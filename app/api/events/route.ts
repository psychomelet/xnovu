import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const apiUrl = 'https://api.novu.co';
    const secretKey = process.env.NOVU_SECRET_KEY;
    const telemetryUrl = `${apiUrl}/v1/telemetry/measure`;

    const response = await fetch(telemetryUrl, {
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `ApiKey ${secretKey}`,
      },
      method: "POST",
      body: JSON.stringify({
        event: body.event,
        data: body.data,
      }),
    });

    if (response.ok) {
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({
      connected: false,
      error: await response.text(),
    });
  } catch (error) {
    return NextResponse.json({
      connected: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
