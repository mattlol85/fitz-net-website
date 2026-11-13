import React from 'react';
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DONE, META, makeMessage, openConversation, renderPage, scriptTurn, setupApiDefaults, typeAndSend,
  userEventSetup, waitForReady,
} from './aiPageTestUtils';
import { NODE_PC } from './aiTestData';
import * as api from '../../services/aiChatApi';
import { downsizeImage } from '../../utils/imageDownsize';

vi.mock('../../contexts/AuthContext', () => ({
  AuthProvider: ({ children }) => <div>{children}</div>,
  useAuth: vi.fn(),
}));

vi.mock('../../services/aiChatApi', () => ({
  listModels: vi.fn(),
  warmUp: vi.fn(),
  getPreferences: vi.fn(),
  updatePreferences: vi.fn(),
  listConversations: vi.fn(),
  createConversation: vi.fn(),
  getConversation: vi.fn(),
  updateConversation: vi.fn(),
  deleteConversation: vi.fn(),
  generateTitle: vi.fn(),
  getContextUsage: vi.fn(),
  sendMessage: vi.fn(),
  regenerateMessage: vi.fn(),
  editMessage: vi.fn(),
  summarizeConversation: vi.fn(),
  listPresets: vi.fn(),
  uploadAttachment: vi.fn(),
  fetchAttachment: vi.fn(),
}));

vi.mock('../../utils/imageDownsize', () => ({
  downsizeImage: vi.fn(),
}));

const VISION_AUTO = { model: 'llama3.2-vision:11b', nodeId: null };
const png = (name = 'photo.png') => new File(['pngdata'], name, { type: 'image/png' });

let urlCounter;
const created = [];
const revoked = [];

beforeEach(() => {
  setupApiDefaults();
  api.getPreferences.mockResolvedValue({ lastTarget: VISION_AUTO, lastPresetId: null });
  api.uploadAttachment.mockImplementation(async (token, { name }) => ({
    id: `att-${name}`, kind: 'image', mimeType: 'image/jpeg', sizeBytes: 100, name,
  }));
  api.fetchAttachment.mockResolvedValue(new Blob(['bytes'], { type: 'image/jpeg' }));
  downsizeImage.mockImplementation(async (file) => ({
    blob: new Blob(['jpegdata'], { type: 'image/jpeg' }),
    name: `${file.name.replace(/\.\w+$/, '')}.jpg`,
  }));
  urlCounter = 0;
  created.length = 0;
  revoked.length = 0;
  URL.createObjectURL = vi.fn(() => {
    urlCounter += 1;
    created.push(`blob:test-${urlCounter}`);
    return `blob:test-${urlCounter}`;
  });
  URL.revokeObjectURL = vi.fn((url) => revoked.push(url));
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  [api.sendMessage, api.regenerateMessage, api.editMessage].forEach((fn) => fn.mockReset());
});

const fileInput = () => screen.getByLabelText('Choose images');
const attach = (...files) => fireEvent.change(fileInput(), { target: { files } });
const attachButton = () => screen.getByRole('button', { name: 'Attach image' });

describe('attach button gating', () => {
  it('should be enabled when the selected model can read images', async () => {
    renderPage();
    await waitForReady();

    expect(attachButton()).toBeEnabled();
  });

  it('should be disabled with an explanation for a model without vision', async () => {
    api.getPreferences.mockResolvedValue({ lastTarget: { model: 'llama3.1:8b', nodeId: null }, lastPresetId: null });
    renderPage();
    await waitForReady();

    expect(attachButton()).toBeDisabled();
    expect(attachButton()).toHaveAttribute('title', "This model can't read images");
    expect(attachButton()).toHaveAccessibleDescription("This model can't read images");
  });

  it('should use the pinned node copy of the model, not the Auto row', async () => {
    openConversation([makeMessage({ id: 'u1', content: 'Hi' })], { target: { model: 'llama3.2-vision:11b', nodeId: NODE_PC } });
    await screen.findByText('Hi');
    expect(attachButton()).toBeEnabled();
    cleanup();

    // Rig-2 does not list the vision model at all, so a pin to it cannot read images.
    openConversation([makeMessage({ id: 'u1', content: 'Hi' })], { target: { model: 'llama3.2-vision:11b', nodeId: 'node-rig' } });
    await screen.findByText('Hi');
    expect(attachButton()).toBeDisabled();
  });
});

describe('adding images', () => {
  it('should reject files that are not PNG, JPEG or WebP', async () => {
    renderPage();
    await waitForReady();

    attach(new File(['x'], 'anim.gif', { type: 'image/gif' }), new File(['x'], 'doc.pdf', { type: 'application/pdf' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Only PNG, JPEG and WebP images can be attached.');
    expect(downsizeImage).not.toHaveBeenCalled();
    expect(api.uploadAttachment).not.toHaveBeenCalled();
    expect(screen.queryByRole('list', { name: 'Images to send' })).not.toBeInTheDocument();
  });

  it('should keep the valid files when some are rejected', async () => {
    renderPage();
    await waitForReady();

    attach(png('ok.png'), new File(['x'], 'anim.gif', { type: 'image/gif' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Only PNG');
    await waitFor(() => expect(api.uploadAttachment).toHaveBeenCalledTimes(1));
  });

  it('should accept at most 4 images per message', async () => {
    renderPage();
    await waitForReady();

    attach(png('1.png'), png('2.png'), png('3.png'), png('4.png'), png('5.png'));

    expect(await screen.findByRole('alert')).toHaveTextContent('up to 4 images');
    await waitFor(() => expect(api.uploadAttachment).toHaveBeenCalledTimes(4));
    expect(within(screen.getByRole('list', { name: 'Images to send' })).getAllByRole('listitem')).toHaveLength(4);
    expect(attachButton()).toBeDisabled();
  });

  it('should downsize each image and upload the re-encoded JPEG as base64', async () => {
    renderPage();
    await waitForReady();
    const original = png('holiday.png');

    attach(original);

    await waitFor(() => expect(api.uploadAttachment).toHaveBeenCalled());
    expect(downsizeImage).toHaveBeenCalledWith(original);
    expect(api.uploadAttachment).toHaveBeenCalledWith('jwt', {
      name: 'holiday.jpg',
      mimeType: 'image/jpeg',
      dataBase64: btoa('jpegdata'),
    });
  });

  it('should show an uploading chip, then a thumbnail, and remove it with a revoked preview', async () => {
    const user = userEventSetup();
    let finish;
    api.uploadAttachment.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    renderPage();
    await waitForReady();

    attach(png('pic.png'));

    const list = await screen.findByRole('list', { name: 'Images to send' });
    expect(await within(list).findByText('Uploading pic.jpg')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();

    await act(async () => finish({ id: 'att-1', kind: 'image', name: 'pic.jpg' }));
    await waitFor(() => expect(within(list).queryByText(/Uploading/)).not.toBeInTheDocument());

    await user.click(within(list).getByRole('button', { name: 'Remove pic.jpg' }));

    expect(screen.queryByRole('list', { name: 'Images to send' })).not.toBeInTheDocument();
    expect(revoked).toContain(created[0]);
  });

  it('should mark an image that failed to upload and block sending until it is removed', async () => {
    const user = userEventSetup();
    api.uploadAttachment.mockRejectedValue(new Error('Images can be at most 3 MB.'));
    renderPage();
    await waitForReady();

    attach(png('big.png'));

    expect(await screen.findByText('Failed')).toBeInTheDocument();
    await user.type(screen.getByRole('textbox', { name: 'Message' }), 'hello');
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
    expect(screen.getByText('Remove the images that failed to upload')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Remove big.jpg' }));
    expect(screen.getByRole('button', { name: 'Send' })).toBeEnabled();
  });

  it('should accept an image pasted from the clipboard', async () => {
    renderPage();
    await waitForReady();

    fireEvent.paste(screen.getByRole('textbox', { name: 'Message' }), {
      clipboardData: { files: [png('screenshot.png')], getData: () => '' },
    });

    await waitFor(() => expect(api.uploadAttachment).toHaveBeenCalledTimes(1));
  });

  it('should accept images dropped on the composer', async () => {
    renderPage();
    await waitForReady();
    const form = screen.getByRole('textbox', { name: 'Message' }).closest('form');

    fireEvent.dragOver(form, { dataTransfer: { types: ['Files'] } });
    expect(form).toHaveClass('ai-chat__composer--drag');
    fireEvent.drop(form, { dataTransfer: { types: ['Files'], files: [png('dropped.png')] } });

    await waitFor(() => expect(api.uploadAttachment).toHaveBeenCalledTimes(1));
    expect(form).not.toHaveClass('ai-chat__composer--drag');
  });

  it('should explain that a paste or drop is ignored for a model without vision', async () => {
    api.getPreferences.mockResolvedValue({ lastTarget: { model: 'llama3.1:8b', nodeId: null }, lastPresetId: null });
    renderPage();
    await waitForReady();

    fireEvent.paste(screen.getByRole('textbox', { name: 'Message' }), {
      clipboardData: { files: [png()], getData: () => '' },
    });

    expect(await screen.findByRole('alert')).toHaveTextContent("This model can't read images");
    expect(api.uploadAttachment).not.toHaveBeenCalled();
  });
});

describe('sending images', () => {
  it('should wait for uploads, then send the attachment ids with the message', async () => {
    const user = userEventSetup();
    const turn = scriptTurn();
    let finish;
    api.uploadAttachment.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    renderPage();
    await waitForReady();
    attach(png('pic.png'));
    await screen.findByText('Uploading pic.jpg');

    await user.type(screen.getByRole('textbox', { name: 'Message' }), 'What is this?{Enter}');
    expect(api.sendMessage).not.toHaveBeenCalled();

    await act(async () => finish({ id: 'att-1', kind: 'image', mimeType: 'image/jpeg', name: 'pic.jpg' }));
    await user.keyboard('{Enter}');
    await turn.whenStarted();

    expect(turn.body).toEqual({ content: 'What is this?', attachmentIds: ['att-1'], target: VISION_AUTO });
    // The sent image shows in the conversation, fetched with the bearer token.
    expect(await screen.findByRole('button', { name: 'Open image pic.jpg' })).toBeInTheDocument();
    expect(api.fetchAttachment).toHaveBeenCalledWith('jwt', 'att-1');
    expect(screen.queryByRole('list', { name: 'Images to send' })).not.toBeInTheDocument();
  });

  it('should allow sending images without any text', async () => {
    const user = userEventSetup();
    const turn = scriptTurn();
    renderPage();
    await waitForReady();
    attach(png('only.png'));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Send' })).toBeEnabled());

    await user.click(screen.getByRole('button', { name: 'Send' }));
    await turn.whenStarted();

    expect(turn.body).toEqual({ content: '', attachmentIds: ['att-only.jpg'], target: VISION_AUTO });
  });

  it('should put the text and images back when the send is rejected up front', async () => {
    const user = userEventSetup();
    api.sendMessage.mockRejectedValueOnce(Object.assign(new Error('A reply is already being generated.'), { status: 409 }));
    renderPage();
    await waitForReady();
    attach(png('pic.png'));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Send' })).toBeEnabled());

    await typeAndSend(user, 'try this');

    expect(await screen.findByText('A reply is already being generated.')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Message' })).toHaveValue('try this');
    expect(screen.getByRole('button', { name: 'Remove pic.jpg' })).toBeInTheDocument();
  });

  it('should keep pending images but block Send when the selection moves to a model without vision', async () => {
    const user = userEventSetup();
    renderPage();
    await waitForReady();
    attach(png('pic.png'));
    await screen.findByRole('button', { name: 'Remove pic.jpg' });
    await user.type(screen.getByRole('textbox', { name: 'Message' }), 'look');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Send' })).toBeEnabled());

    await user.click(screen.getByRole('button', { name: /llama3\.2-vision/ }));
    await user.click(within(screen.getByRole('dialog')).getAllByRole('option', { name: /llama3\.1:8b/ })[0]);

    expect(await screen.findByText('Switch to a vision model or remove the images')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Remove pic.jpg' })).toBeInTheDocument();
    await user.keyboard('{Enter}');
    expect(api.sendMessage).not.toHaveBeenCalled();
  });
});

describe('attachments in messages', () => {
  const withImage = (id = 'att-a', name = 'bell.jpg') =>
    makeMessage({
      id: 'u1', seq: 1, role: 'user', content: 'What is this?',
      attachments: [{ id, kind: 'image', mimeType: 'image/jpeg', sizeBytes: 1, name }],
    });

  it('should show thumbnails through object URLs and revoke them when the messages go away', async () => {
    const view = openConversation([withImage()]);

    const thumb = await screen.findByRole('img', { name: 'bell.jpg' });

    expect(api.fetchAttachment).toHaveBeenCalledWith('jwt', 'att-a');
    expect(thumb).toHaveAttribute('src', created[0]);
    view.unmount();
    expect(revoked).toContain(created[0]);
  });

  it('should fetch an image once even when it is shown twice', async () => {
    openConversation([
      withImage('att-a', 'one.jpg'),
      makeMessage({ id: 'a1', seq: 2, role: 'assistant', content: 'A', generation: { model: 'llama3.2-vision:11b', nodeName: 'Matt-PC' } }),
      { ...withImage('att-a', 'one.jpg'), id: 'u2', seq: 3 },
    ]);

    await waitFor(() => expect(screen.getAllByRole('img', { name: 'one.jpg' })).toHaveLength(2));

    expect(api.fetchAttachment).toHaveBeenCalledTimes(1);
    expect(created).toHaveLength(1);
  });

  it('should say when an image cannot be loaded', async () => {
    api.fetchAttachment.mockRejectedValue(new Error('gone'));
    openConversation([withImage()]);

    expect(await screen.findByText('Image unavailable')).toBeInTheDocument();
  });

  it('should open the image in a lightbox, close it with Escape and return focus to the thumbnail', async () => {
    const user = userEventSetup();
    openConversation([withImage()]);
    const thumb = await screen.findByRole('button', { name: 'Open image bell.jpg' });
    await waitFor(() => expect(thumb).toBeEnabled());

    await user.click(thumb);
    const dialog = screen.getByRole('dialog', { name: 'bell.jpg' });
    expect(within(dialog).getByRole('img', { name: 'bell.jpg' })).toHaveAttribute('src', created[0]);
    expect(within(dialog).getByRole('button', { name: 'Close' })).toHaveFocus();

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog', { name: 'bell.jpg' })).not.toBeInTheDocument();
    expect(thumb).toHaveFocus();
  });

  it('should keep the attachments when a message is edited (no attachmentIds in the request)', async () => {
    const user = userEventSetup();
    const turn = scriptTurn(api.editMessage);
    openConversation([withImage()]);
    await screen.findByRole('img', { name: 'bell.jpg' });

    await user.click(screen.getByRole('button', { name: 'Edit' }));
    const box = screen.getByRole('textbox', { name: 'Edit message' });
    await user.clear(box);
    await user.type(box, 'What is this bell?');
    await user.click(screen.getByRole('button', { name: /save & send/i }));
    await turn.whenStarted();

    expect(turn.body).toEqual({ content: 'What is this bell?', target: { model: 'llama3.1:8b', nodeId: null } });
    expect(screen.getByRole('img', { name: 'bell.jpg' })).toBeInTheDocument();
  });

  it('should offer a vision model when MODEL_NOT_VISION ends a reply, and regenerate with the choice', async () => {
    const user = userEventSetup();
    const turn = scriptTurn(api.regenerateMessage);
    openConversation(
      [
        withImage(),
        makeMessage({
          id: 'a1', seq: 2, role: 'assistant', content: '', status: 'error',
          error: { code: 'MODEL_NOT_VISION', message: "llama3.1:8b can't read images." },
          generation: { model: 'llama3.1:8b', nodeId: NODE_PC, nodeName: 'Matt-PC' },
        }),
      ],
      { target: { model: 'llama3.1:8b', nodeId: null } }
    );

    await user.click(await screen.findByRole('button', { name: 'Choose a vision model' }));
    const dialog = screen.getByRole('dialog', { name: 'Choose a vision model for this answer' });

    const names = within(dialog).getAllByRole('option').map((o) => o.querySelector('.ai-chat__option-name').textContent);
    expect(new Set(names)).toEqual(new Set(['llama3.2-vision:11b']));
    await user.click(within(dialog).getAllByRole('option')[0]);
    await turn.whenStarted();

    expect(turn.messageId).toBe('a1');
    expect(turn.body).toEqual({ target: { model: 'llama3.2-vision:11b', nodeId: null } });
  });

  it('should note when earlier images were not sent to a model that cannot read them', async () => {
    const user = userEventSetup();
    const turn = scriptTurn();
    api.getPreferences.mockResolvedValue({ lastTarget: { model: 'llama3.1:8b', nodeId: null }, lastPresetId: null });
    renderPage();
    await waitForReady();
    await typeAndSend(user, 'Hello again');
    await turn.whenStarted();

    await turn.emit('meta', { ...META, context: { ...META.context, imagesOmitted: 2 } });
    await turn.emit('token', { content: 'Hi' });
    await turn.emit('done', DONE);
    await turn.finish('done', DONE);

    expect(await screen.findByText("2 earlier images weren't sent — this model can't read images.")).toBeInTheDocument();
  });
});
