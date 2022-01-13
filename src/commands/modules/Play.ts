import { SlashCommandBuilder } from '@discordjs/builders';
import { CommandInteractionHelper, YouTubeInterface, YouTubeVideo } from 'bot-classes';
import { ResponseEmojis } from 'bot-config';
import { BaseCommand } from '../BaseCommand';
import { command } from '../decorators/command';

export default class Play implements BaseCommand {
	register() {
		return new SlashCommandBuilder()
			.setName('play')
			.setDescription("If the bot is in the voice chat, it will enqueue the song, if it's not, it will join the chat and play")
			.addStringOption(option =>
				option.setName('query').setDescription('A search query. First result from the search query will be used.').setRequired(true)
			);
	}

	@command({
		ephemeral: false,
		enforceVoiceConnection: true
	})
	async runner(handler: CommandInteractionHelper) {
		const query = handler.commandInteraction.options.getString('query', true);
		const youtubeInterface = YouTubeInterface.fromGuild(handler.guild);
		if (youtubeInterface.busy) {
			const youtubeUrl = handler.commandInteraction.options.getString('url', true);
			const youtubeVideo = YouTubeVideo.fromUrl(youtubeUrl);
			const title = await youtubeVideo.info<string>('.videoDetails.title');

			if (!title) {
				await handler.editWithEmoji(
					'I could not add that item to the queue. Is it a valid URL? Is it age restricted or private?',
					ResponseEmojis.Danger
				);
				return;
			}

			const appended = await youtubeInterface.queue.add(youtubeVideo.id);

			if (appended) await handler.editWithEmoji(`Enqueued \`${title}\`.`, ResponseEmojis.Success);
			else await handler.editWithEmoji('I could not add that item to the queue. Is it a valid URL?', ResponseEmojis.Danger);
		
			return;
		}

		const [video] = await YouTubeVideo.search(query, 1);

		if (!video?.id?.videoId) {
			await handler.editWithEmoji('I could not find a video. Try something less specific?', ResponseEmojis.Danger);
			return;
		}

		const youtubeVideo = YouTubeVideo.fromId(video.id.videoId);
		await youtubeInterface.queue.prepend(youtubeVideo.id);
		await handler.editWithEmoji('Preparing to play...', ResponseEmojis.Loading);
		youtubeInterface.setConnection(handler.joinVoiceChannel());
		const title = await youtubeVideo.info<string>('.videoDetails.title');

		if (title) {
			await handler.commandInteraction.editReply(`🔊 Playing \`${title}\`.`);
		} else {
			await handler.editWithEmoji(
				'Unable to play the video. It might be private, age restricted or something else. It will be skipped.',
				ResponseEmojis.Danger
			);
		}

		while (await youtubeInterface.runner());
		youtubeInterface.deleteConnection();
	}
}
