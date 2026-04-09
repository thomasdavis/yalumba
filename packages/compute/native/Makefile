# yalumba native compute library
# Builds a shared library (.dylib) for macOS / Apple Silicon

CC = cc
CFLAGS = -O3 -march=native -Wall -Wextra -fPIC
LDFLAGS = -shared -lpthread

SRCS = kmer-ops.c run-scanner.c parallel.c bloom-filter.c rare-filter.c
OBJS = $(SRCS:.c=.o)
TARGET = libyalumba-compute.dylib

all: $(TARGET)

$(TARGET): $(OBJS)
	$(CC) $(LDFLAGS) -o $@ $^

%.o: %.c yalumba.h
	$(CC) $(CFLAGS) -c $< -o $@

clean:
	rm -f $(OBJS) $(TARGET)

.PHONY: all clean
