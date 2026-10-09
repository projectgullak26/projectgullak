#!/usr/bin/perl
# Minimal static file server for local development (no CPAN dependencies).
# Usage: perl serve.pl [port] [root]
#   port  - defaults to 8765
#   root  - defaults to the directory containing this script

use strict;
use warnings;
use IO::Socket::INET;
use File::Spec;
use Cwd qw(abs_path);

$| = 1;

my $port = shift @ARGV // 8765;
my $root = shift @ARGV // do {
    my $self = abs_path($0);
    $self =~ s{[/\\][^/\\]+$}{};
    $self;
};
$root = abs_path($root) or die "Cannot resolve root '$root': $!\n";

my %MIME = (
    html => 'text/html; charset=utf-8',
    htm  => 'text/html; charset=utf-8',
    css  => 'text/css; charset=utf-8',
    js   => 'text/javascript; charset=utf-8',
    mjs  => 'text/javascript; charset=utf-8',
    json => 'application/json; charset=utf-8',
    svg  => 'image/svg+xml',
    jpg  => 'image/jpeg',
    jpeg => 'image/jpeg',
    png  => 'image/png',
    gif  => 'image/gif',
    webp => 'image/webp',
    ico  => 'image/x-icon',
    avif => 'image/avif',
    woff => 'font/woff',
    woff2=> 'font/woff2',
    ttf  => 'font/ttf',
    otf  => 'font/otf',
    eot  => 'application/vnd.ms-fontobject',
    txt  => 'text/plain; charset=utf-8',
    md   => 'text/plain; charset=utf-8',
    xml  => 'application/xml; charset=utf-8',
    pdf  => 'application/pdf',
    mp4  => 'video/mp4',
    webm => 'video/webm',
);

my $server = IO::Socket::INET->new(
    LocalAddr => '127.0.0.1',
    LocalPort => $port,
    Proto     => 'tcp',
    Listen    => 64,
    ReuseAddr => 1,
) or die "Cannot listen on 127.0.0.1:$port: $!\n";

my $host = "127.0.0.1:$port";
print "Project Gullak dev server running\n";
print "  root: $root\n";
print "  url:  http://$host/\n";
print "Press Ctrl+C to stop.\n";

sub log_line {
    my ($msg) = @_;
    my @t = localtime;
    printf "[%02d:%02d:%02d] %s\n", $t[2], $t[1], $t[0], $msg;
}

sub send_status {
    my ($fh, $code, $reason, $body, $type) = @_;
    $body //= "$code $reason\n";
    $type //= 'text/plain; charset=utf-8';
    print {$fh} "HTTP/1.1 $code $reason\r\n";
    print {$fh} "Content-Type: $type\r\n";
    print {$fh} "Content-Length: " . length($body) . "\r\n";
    print {$fh} "Connection: close\r\n\r\n";
    print {$fh} $body;
}

while (my $client = $server->accept()) {
    $client->autoflush(1);

    my $request_line = <$client>;
    unless (defined $request_line) {
        close $client;
        next;
    }
    $request_line =~ s/[\r\n]+$//;

    # Drain headers (we do not need them, but must read them off the socket).
    while (my $h = <$client>) {
        last if $h =~ /^\r?\n$/;
    }

    my ($method, $target) = split /\s+/, $request_line;
    unless (defined $method && defined $target) {
        send_status($client, 400, 'Bad Request');
        log_line("400 $request_line");
        close $client;
        next;
    }

    if ($method ne 'GET' && $method ne 'HEAD') {
        send_status($client, 405, 'Method Not Allowed');
        log_line("405 $method $target");
        close $client;
        next;
    }

    # Strip query string / fragment and percent-decode the path.
    my $path = $target;
    $path =~ s/[?#].*$//;
    $path =~ s/%([0-9A-Fa-f]{2})/chr(hex($1))/eg;

    if (index($path, "\0") >= 0) {
        send_status($client, 400, 'Bad Request');
        log_line("400 $method $target");
        close $client;
        next;
    }

    $path =~ s{^/+}{};
    $path = 'index.html' if $path eq '';

    my @parts;
    foreach my $seg (split m{/+}, $path) {
        next if $seg eq '' || $seg eq '.';
        if ($seg eq '..') {
            send_status($client, 403, 'Forbidden');
            log_line("403 $method $target");
            close $client;
            next;
        }
        push @parts, $seg;
    }

    my $file = File::Spec->catfile($root, @parts);
    if (-d $file) {
        $file = File::Spec->catfile($file, 'index.html');
    }

    if (!-e $file) {
        send_status($client, 404, 'Not Found', "404 Not Found: /$path\n");
        log_line("404 $method /$path");
        close $client;
        next;
    }

    open(my $in, '<:raw', $file) or do {
        send_status($client, 403, 'Forbidden');
        log_line("403 $method /$path");
        close $client;
        next;
    };
    local $/ = undef;
    my $data = <$in>;
    close $in;
    $data = '' unless defined $data;

    (my $ext = $file) =~ s/.*\.//;
    $ext = lc $ext;
    my $ct = $MIME{$ext} // 'application/octet-stream';

    print {$client} "HTTP/1.1 200 OK\r\n";
    print {$client} "Content-Type: $ct\r\n";
    print {$client} "Content-Length: " . length($data) . "\r\n";
    print {$client} "Cache-Control: no-cache\r\n";
    print {$client} "Connection: close\r\n\r\n";
    print {$client} $data if $method eq 'GET';
    log_line("200 $method /$path (" . length($data) . " bytes, $ct)");

    close $client;
}
