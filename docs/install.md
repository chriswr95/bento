# Set up Bento for a first trial

For now, **have a coding agent build and install Bento from source** on the computer where you'll use it. The preview downloads can be blocked by OS signing checks; they are not the recommended setup path. Signed downloads are deferred.

Give your agent this prompt:

> Set up Bento on this computer for a first trial. Follow https://github.com/chriswr95/bento/blob/main/docs/agent-setup.md. Build the tested v0.1.0-preview.1 source tag, install a local app, and make it easy to launch again. Preserve existing installations, settings, and workspaces. Run the documented checks with test windows hidden, then open the installed app for me. Report the source revision, install location, and how to launch it.

The [agent setup guide](agent-setup.md) covers prerequisites, exact build commands, native installation locations, shortcuts, verification, and updates on Windows and Mac. GitHub sign-in is fine if your agent uses it, but this public repository can also be cloned without a GitHub account. Your coding agent may require its own account.

## Your first two minutes

1. Choose **Try an example workspace** on the welcome screen.
2. Use the folder chooser to create and select an empty folder, such as **Documents/Bento example**. Bento puts two fictional projects, meeting notes, and actions there.
3. Follow the Project → Meeting → Daily review tour. Edit freely; changes save automatically.
4. At the end, choose **Create my workspace** for your own work, or **Keep exploring**. The example remains separate. Replay its walkthrough from the workspace-name menu.

Already have a Bento folder? Choose **Open workspace** instead. Later launches return to your last workspace and page. Your Markdown files live in the folder you choose, separately from the installed app.

## Later: direct downloads

Mac Developer ID signing and notarization, Windows publisher signing, and installation checks on fresh computers are tracked as IDEA-012 in the [design backlog](design.md#11-future-ideas). The current [preview assets](https://github.com/chriswr95/bento/releases/tag/v0.1.0-preview.1) remain experimental; an ad-hoc Mac signature does not establish a trusted publisher.
