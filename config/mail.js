import { Resend } from "resend";

const getResendClient = () => {
	const apiKey = process.env.RESEND_API_KEY?.trim();

	if (!apiKey) {
		throw new Error("Missing RESEND_API_KEY");
	}

	return new Resend(apiKey);
};

const mailClient = {
	sendMail: async ({ from, to, subject, text, html }) => {
		const { data, error } = await getResendClient().emails.send({
			from: from || process.env.MAIL_FROM_ADDRESS || "onboarding@resend.dev",
			to,
			subject,
			...(text ? { text } : {}),
			...(html ? { html } : {}),
		});

		if (error) {
			throw new Error(error.message || JSON.stringify(error));
		}

		return data;
	},
};

export default mailClient;