package main

import (
	"bufio"
	"context"
	"fmt"
	"os"
	"strings"
	"syscall"

	"golang.org/x/crypto/bcrypt"
	"golang.org/x/term"

	"laundry-app/internal/database"
)

func main() {
	reader := bufio.NewReader(os.Stdin)

	fmt.Print("Username: ")
	username, err := reader.ReadString('\n')
	if err != nil {
		fmt.Println("Could not read username.")
		os.Exit(1)
	}
	username = strings.TrimSpace(username)

	if username == "" {
		fmt.Println("Username is required.")
		os.Exit(1)
	}

	fmt.Print("Full name: ")
	fullName, err := reader.ReadString('\n')
	if err != nil {
		fmt.Println("Could not read full name.")
		os.Exit(1)
	}
	fullName = strings.TrimSpace(fullName)

	if fullName == "" {
		fmt.Println("Full name is required.")
		os.Exit(1)
	}

	fmt.Print("Password: ")
	passwordBytes, err := term.ReadPassword(int(syscall.Stdin))
	fmt.Println()
	if err != nil {
		fmt.Printf("Could not connect to database: %v\n", err)
		os.Exit(1)
	}

	if len(passwordBytes) < 4 {
		fmt.Println("Use a password of at least 12 bytes.")
		os.Exit(1)
	}

	hash, err := bcrypt.GenerateFromPassword(passwordBytes, bcrypt.DefaultCost)
	if err != nil {
		fmt.Println("Could not secure password.")
		os.Exit(1)
	}

	ctx := context.Background()
	db, err := database.Connect(ctx)
	if err != nil {
		fmt.Println("Could not connect to database.")
		os.Exit(1)
	}
	defer db.Close()

	_, err = db.Exec(ctx, `
		INSERT INTO users (username, password_hash, full_name)
		VALUES ($1, $2, $3)
	`, username, string(hash), fullName)
	if err != nil {
		fmt.Println("Could not create account. Check whether the username already exists.")
		os.Exit(1)
	}

	fmt.Println("Account created successfully.")
}
