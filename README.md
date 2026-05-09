# Wasps

It's 2006 in Ipswich and there's nothing to do but play cards and drink beer.

Living in the middle of nowhere, working at BT on a summer internship with no Internet access outside of work what else was there to do?

I created this originally in C#/.NET 1.1 to run on Windows XP and PocketPC.

I've now updated it to run in a browser on basically anything.

# Demo

[🃏 Play](https://wasps.jasoncabot.me)

![demo of card game](https://user-images.githubusercontent.com/93598/188973544-f895728c-95d2-4f73-82b1-7466ced5dc4f.png)

# Rules

## Aim of the game

Be the first player to get rid of all your cards

## How to play

- Each player is dealt 7 cards
- Each player takes it in turn to play cards from their hand
- Play continues clockwise by default until the winner plays their last card

- You must play a card matching the suit or rank of the last card played
- You can play more than one card on each turn
  - Cards must be the same rank, or
  - Cards must be the same suit and form a run, e.g [ 4, 5, 6 ]

- There are special cards that have special meanings
  - An **Ace** can be played on anything and gives a choice for the next suit that must be played
  - A **Two** causes the next player to pick up 2 cards
  - A **Black Jack** causes the next player to pick up 7 cards
  - A **Red Jack** cancels the effect of a Black Jack
  - A **Queen** immediately reverses the direction of play
  - A **Joker** can be played on anything, forces the next player to pick up 4 cards and gives a choice for the next suit that must be played
- Some Special cards can be stacked to increase their effect
  - Aces can be stacked but only give 1 choice for the next suit
  - 4 2s cause the next player to pick up 8 cards
  - 2 Black Jacks cause the next player to pick up 14 cards
  - 1 or 3 Queens changes direction, 2 Queens would not
  - 2 Jokers causes the next player to pick up 8 cards
