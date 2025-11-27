import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import Navbar from '@/components/Navbar';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageCircle, Send, ArrowLeft, Circle } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Message {
  id: string;
  content: string;
  sender_id: string;
  receiver_id: string;
  listing_id: string;
  read: boolean;
  created_at: string;
}

interface Conversation {
  listing_id: string;
  listing_title: string;
  listing_image: string;
  other_user_id: string;
  other_user_name: string;
  last_message: string;
  last_message_time: string;
  unread_count: number;
}

const Messages = () => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchConversations();
    }
  }, [user]);

  useEffect(() => {
    if (selectedConversation && user) {
      fetchMessages();
      markMessagesAsRead();
    }
  }, [selectedConversation]);

  // Real-time subscription for new messages
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('messages-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `receiver_id=eq.${user.id}`
        },
        () => {
          fetchConversations();
          if (selectedConversation) {
            fetchMessages();
            markMessagesAsRead();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, selectedConversation]);

  const fetchConversations = async () => {
    if (!user) return;

    // Get all messages where user is sender or receiver
    const { data: messagesData, error } = await supabase
      .from('messages')
      .select(`
        *,
        listings:listing_id (id, title, images)
      `)
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching messages:', error);
      setLoading(false);
      return;
    }

    // Group by listing and other user
    const conversationMap = new Map<string, any>();
    
    for (const msg of messagesData || []) {
      const otherUserId = msg.sender_id === user.id ? msg.receiver_id : msg.sender_id;
      const key = `${msg.listing_id}-${otherUserId}`;
      
      if (!conversationMap.has(key)) {
        conversationMap.set(key, {
          listing_id: msg.listing_id,
          listing_title: msg.listings?.title || 'Unknown Listing',
          listing_image: msg.listings?.images?.[0] || '',
          other_user_id: otherUserId,
          other_user_name: '',
          last_message: msg.content,
          last_message_time: msg.created_at,
          unread_count: 0
        });
      }
      
      // Count unread messages
      if (!msg.read && msg.receiver_id === user.id) {
        const conv = conversationMap.get(key);
        conv.unread_count++;
      }
    }

    // Fetch other user names
    const otherUserIds = [...new Set([...conversationMap.values()].map(c => c.other_user_id))];
    if (otherUserIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name')
        .in('id', otherUserIds);
      
      const profileMap = new Map(profiles?.map(p => [p.id, p.name]) || []);
      
      conversationMap.forEach(conv => {
        conv.other_user_name = profileMap.get(conv.other_user_id) || 'Unknown User';
      });
    }

    setConversations([...conversationMap.values()]);
    setLoading(false);
  };

  const fetchMessages = async () => {
    if (!selectedConversation || !user) return;

    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('listing_id', selectedConversation.listing_id)
      .or(`and(sender_id.eq.${user.id},receiver_id.eq.${selectedConversation.other_user_id}),and(sender_id.eq.${selectedConversation.other_user_id},receiver_id.eq.${user.id})`)
      .order('created_at', { ascending: true });

    if (!error && data) {
      setMessages(data);
    }
  };

  const markMessagesAsRead = async () => {
    if (!selectedConversation || !user) return;

    await supabase
      .from('messages')
      .update({ read: true })
      .eq('listing_id', selectedConversation.listing_id)
      .eq('receiver_id', user.id)
      .eq('sender_id', selectedConversation.other_user_id);
    
    // Update local conversation unread count
    setConversations(prev => 
      prev.map(c => 
        c.listing_id === selectedConversation.listing_id && c.other_user_id === selectedConversation.other_user_id
          ? { ...c, unread_count: 0 }
          : c
      )
    );
  };

  const sendMessage = async () => {
    if (!user || !selectedConversation || newMessage.trim().length === 0) return;

    setSending(true);
    const { error } = await supabase.from('messages').insert([{
      listing_id: selectedConversation.listing_id,
      sender_id: user.id,
      receiver_id: selectedConversation.other_user_id,
      content: newMessage.trim()
    }]);

    if (error) {
      toast.error('Failed to send message');
    } else {
      setNewMessage('');
      fetchMessages();
      fetchConversations();
    }
    setSending(false);
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) {
      return date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    } else if (days === 1) {
      return 'Yesterday';
    } else if (days < 7) {
      return date.toLocaleDateString('de-DE', { weekday: 'short' });
    } else {
      return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
    }
  };

  const totalUnread = conversations.reduce((sum, c) => sum + c.unread_count, 0);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-6">
          <MessageCircle className="w-8 h-8 text-primary" />
          <h1 className="text-3xl font-bold">Messages</h1>
          {totalUnread > 0 && (
            <Badge variant="destructive">{totalUnread} unread</Badge>
          )}
        </div>

        {loading ? (
          <div className="text-center py-12 text-muted-foreground">Loading messages...</div>
        ) : conversations.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <MessageCircle className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No messages yet</h3>
              <p className="text-muted-foreground">When you message sellers or receive messages, they'll appear here.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Conversations List */}
            <Card className={cn("lg:col-span-1", selectedConversation && "hidden lg:block")}>
              <ScrollArea className="h-[600px]">
                <div className="divide-y divide-border">
                  {conversations.map((conv) => (
                    <button
                      key={`${conv.listing_id}-${conv.other_user_id}`}
                      onClick={() => setSelectedConversation(conv)}
                      className={cn(
                        "w-full p-4 text-left hover:bg-muted/50 transition-colors flex gap-3",
                        selectedConversation?.listing_id === conv.listing_id && 
                        selectedConversation?.other_user_id === conv.other_user_id && 
                        "bg-muted"
                      )}
                    >
                      <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                        {conv.listing_image && (
                          <img src={conv.listing_image} alt="" className="w-full h-full object-cover" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="font-medium truncate">{conv.other_user_name}</span>
                          <span className="text-xs text-muted-foreground flex-shrink-0">
                            {formatTime(conv.last_message_time)}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground truncate">{conv.listing_title}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <p className={cn(
                            "text-sm truncate flex-1",
                            conv.unread_count > 0 ? "font-medium text-foreground" : "text-muted-foreground"
                          )}>
                            {conv.last_message}
                          </p>
                          {conv.unread_count > 0 && (
                            <Circle className="w-2.5 h-2.5 fill-primary text-primary flex-shrink-0" />
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </Card>

            {/* Chat View */}
            <Card className={cn("lg:col-span-2", !selectedConversation && "hidden lg:block")}>
              {selectedConversation ? (
                <div className="flex flex-col h-[600px]">
                  {/* Chat Header */}
                  <div className="p-4 border-b flex items-center gap-3">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="lg:hidden"
                      onClick={() => setSelectedConversation(null)}
                    >
                      <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <div className="w-10 h-10 rounded-lg overflow-hidden bg-muted">
                      {selectedConversation.listing_image && (
                        <img src={selectedConversation.listing_image} alt="" className="w-full h-full object-cover" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{selectedConversation.other_user_name}</p>
                      <p className="text-sm text-muted-foreground truncate">{selectedConversation.listing_title}</p>
                    </div>
                  </div>

                  {/* Messages */}
                  <ScrollArea className="flex-1 p-4">
                    <div className="space-y-4">
                      {messages.map((msg) => (
                        <div
                          key={msg.id}
                          className={cn(
                            "flex",
                            msg.sender_id === user?.id ? "justify-end" : "justify-start"
                          )}
                        >
                          <div
                            className={cn(
                              "max-w-[80%] rounded-2xl px-4 py-2",
                              msg.sender_id === user?.id
                                ? "bg-primary text-primary-foreground rounded-br-md"
                                : "bg-muted rounded-bl-md"
                            )}
                          >
                            <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                            <p className={cn(
                              "text-xs mt-1",
                              msg.sender_id === user?.id ? "text-primary-foreground/70" : "text-muted-foreground"
                            )}>
                              {formatTime(msg.created_at)}
                              {msg.sender_id === user?.id && (
                                <span className="ml-2">
                                  {msg.read ? '✓✓' : '✓'}
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>

                  {/* Message Input */}
                  <div className="p-4 border-t">
                    <div className="flex gap-2">
                      <Textarea
                        placeholder="Type a message..."
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            sendMessage();
                          }
                        }}
                        rows={1}
                        className="min-h-[44px] max-h-32 resize-none"
                      />
                      <Button onClick={sendMessage} disabled={sending || !newMessage.trim()}>
                        <Send className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-[600px] flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <MessageCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Select a conversation to view messages</p>
                  </div>
                </div>
              )}
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default Messages;
