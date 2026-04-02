import twilio from "twilio";

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
);

export async function sendSms(to: string, body: string): Promise<void> {
  await client.messages.create({
    body,
    from: process.env.TWILIO_PHONE_NUMBER!,
    to,
  });
}

export async function sendAlertToAll(
  phones: string[],
  message: string
): Promise<void> {
  await Promise.all(phones.map((phone) => sendSms(phone, message)));
}
