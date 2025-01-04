import rootScope from '../rootScope';
import {AppManager} from './manager';
import {logger, LogTypes} from '../logger';
import type {BroadcastEvents} from '../rootScope';
import {generateAIReply} from '../openai';

export class AppAutoReplyManager extends AppManager {
  private log = logger('AUTO-REPLY', LogTypes.Log | LogTypes.Warn | LogTypes.Debug | LogTypes.Error);

  constructor() {
    super();
    console.log('[AUTO-REPLY] constructor called');
  }

  protected after() {
    console.log('[AUTO-REPLY] initializing...');

    // Listen for new messages
    this.apiUpdatesManager.addMultipleEventsListeners({
      updateNewMessage: this.onUpdateNewMessage,
      updateNewChannelMessage: this.onUpdateNewMessage
    });

    // Listen for settings changes
    rootScope.addEventListener('settings_updated', ({settings}) => {
      console.log('[AUTO-REPLY] settings updated:', settings);
      console.log('[AUTO-REPLY] autoAIReply setting updated to:', settings.autoAIReply);
    });

    console.log('[AUTO-REPLY] initialization complete');
  }

  private onUpdateNewMessage = async(update: any) => {
    try {
      console.log('[AUTO-REPLY] received new message update:', update);

      const message = update.message;
      if(!message) {
        console.log('[AUTO-REPLY] no message in update');
        return;
      }

      // Get current settings from state
      const state = await this.appStateManager.getState();
      const autoReplyEnabled = state.settings?.autoAIReply;
      const agentType = state.settings?.autoAIReplyAgent || 'professional';
      console.log('[AUTO-REPLY] auto reply enabled:', autoReplyEnabled, 'agent type:', agentType);

      // Skip if auto-reply is disabled
      if(!autoReplyEnabled) {
        console.log('[AUTO-REPLY] auto-reply is disabled');
        return;
      }

      // Skip outgoing messages
      if(message.pFlags?.out) {
        console.log('[AUTO-REPLY] skipping outgoing message');
        return;
      }

      // Skip if no peerId
      const peerId = message.peerId;
      if(!peerId) {
        console.log('[AUTO-REPLY] no peerId found');
        return;
      }

      // Skip if message is from a channel
      if(this.appPeersManager.isChannel(peerId)) {
        console.log('[AUTO-REPLY] skipping channel message');
        return;
      }

      // Generate AI reply
      console.log('[AUTO-REPLY] generating AI reply for message:', message.message);
      let customType: string;
      if(agentType === 'custom') {
        const state = await this.appStateManager.getState();
        customType = state.settings?.customAIReplyAgent;
      }
      const aiReply = await generateAIReply(message.message, peerId, agentType, customType);
      
      if(aiReply) {
        // Send auto-reply as a new message
        console.log('[AUTO-REPLY] attempting to send AI reply to peerId:', peerId);
        await this.appMessagesManager.sendText({
          peerId,
          text: aiReply
        });
        console.log('[AUTO-REPLY] AI reply sent successfully');
      } else {
        console.log('[AUTO-REPLY] No AI reply generated, using fallback');
        await this.appMessagesManager.sendText({
          peerId,
          text: 'I\'m currently away and will respond to your message later.'
        });
      }
    } catch(err) {
      console.error('[AUTO-REPLY] Error handling new message:', err);
      
      // Get peerId from update if available
      const peerId = update?.message?.peerId;
      if(peerId) {
        try {
          await this.appMessagesManager.sendText({
            peerId,
            text: 'I\'m currently away and will respond to your message later.'
          });
        } catch(e) {
          console.error('[AUTO-REPLY] Error sending fallback message:', e);
        }
      }
    }
  };
}

const appAutoReplyManager = new AppAutoReplyManager();
export default appAutoReplyManager;
