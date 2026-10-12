package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"laundry-app/internal/database"

	"golang.org/x/crypto/bcrypt"
)

type HealthResponse struct {
	Status  string `json:"status"`
	Message string `json:"message"`
}

type Customer struct {
	ID        int64     `json:"id"`
	Name      string    `json:"name"`
	Phone     *string   `json:"phone"`
	CreatedAt time.Time `json:"created_at"`
}

type CreateCustomerRequest struct {
	Name  string  `json:"name"`
	Phone *string `json:"phone"`
}

type LoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}
type CreateLaundryOrderRequest struct {
	CustomerID int64                     `json:"customer_id"`
	PickupDate string                    `json:"pickup_date"`
	Notes      string                    `json:"notes"`
	Items      []LaundryOrderItemRequest `json:"items"`
}

type LaundryOrderItemRequest struct {
	ItemType  string  `json:"item_type"`
	Quantity  int     `json:"quantity"`
	UnitPrice float64 `json:"unit_price"`
}

type LaundryOrderResponse struct {
	OrderID       int64   `json:"order_id"`
	CustomerID    int64   `json:"customer_id"`
	PickupDate    string  `json:"pickup_date"`
	TotalAmount   float64 `json:"total_amount"`
	PaymentStatus string  `json:"payment_status"`
}

func main() {
	mux := http.NewServeMux()

	mux.HandleFunc("GET /api/health", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, HealthResponse{
			Status:  "ok",
			Message: "Laundry API is running",
		})
	})

	mux.HandleFunc("GET /api/db-health", func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
		defer cancel()

		db, err := database.Connect(ctx)
		if err != nil {
			writeJSON(w, http.StatusServiceUnavailable, HealthResponse{
				Status:  "error",
				Message: "Database connection failed",
			})
			return
		}
		defer db.Close()

		writeJSON(w, http.StatusOK, HealthResponse{
			Status:  "ok",
			Message: "Database connected",
		})
	})

	mux.HandleFunc("POST /api/login", func(w http.ResponseWriter, r *http.Request) {
		r.Body = http.MaxBytesReader(w, r.Body, 1<<20)

		var request LoginRequest
		if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{
				"error": "Invalid request",
			})
			return
		}

		request.Username = strings.TrimSpace(request.Username)
		if request.Username == "" || request.Password == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{
				"error": "Username and password are required",
			})
			return
		}

		ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
		defer cancel()

		db, err := database.Connect(ctx)
		if err != nil {
			writeJSON(w, http.StatusServiceUnavailable, map[string]string{
				"error": "Database connection failed",
			})
			return
		}
		defer db.Close()

		var passwordHash string
		var fullName string

		err = db.QueryRow(ctx, `
			SELECT password_hash, full_name
			FROM users
			WHERE username = $1
		`, request.Username).Scan(&passwordHash, &fullName)

		if err != nil {
			writeJSON(w, http.StatusUnauthorized, map[string]string{
				"error": "Invalid username or password",
			})
			return
		}

		if err := bcrypt.CompareHashAndPassword(
			[]byte(passwordHash),
			[]byte(request.Password),
		); err != nil {
			writeJSON(w, http.StatusUnauthorized, map[string]string{
				"error": "Invalid username or password",
			})
			return
		}

		writeJSON(w, http.StatusOK, map[string]string{
			"message":   "Login successful",
			"username":  request.Username,
			"full_name": fullName,
		})
	})

	mux.HandleFunc("GET /api/customers", func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
		defer cancel()

		db, err := database.Connect(ctx)
		if err != nil {
			writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "Database connection failed"})
			return
		}
		defer db.Close()

		rows, err := db.Query(ctx, `
			SELECT customer_id, name, phone, created_at
			FROM customers
			ORDER BY customer_id
		`)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Could not read customers"})
			return
		}
		defer rows.Close()

		customers := []Customer{}
		for rows.Next() {
			var customer Customer
			if err := rows.Scan(&customer.ID, &customer.Name, &customer.Phone, &customer.CreatedAt); err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Could not read customer data"})
				return
			}
			customers = append(customers, customer)
		}

		if err := rows.Err(); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Could not read customer data"})
			return
		}

		writeJSON(w, http.StatusOK, customers)
	})

	mux.HandleFunc("POST /api/customers", func(w http.ResponseWriter, r *http.Request) {
		r.Body = http.MaxBytesReader(w, r.Body, 1<<20)

		var request CreateCustomerRequest
		if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Invalid JSON"})
			return
		}

		if strings.TrimSpace(request.Name) == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "Name is required"})
			return
		}

		ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
		defer cancel()

		db, err := database.Connect(ctx)
		if err != nil {
			writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "Database connection failed"})
			return
		}
		defer db.Close()

		var customer Customer
		err = db.QueryRow(ctx, `
			INSERT INTO customers (name, phone)
			VALUES ($1, $2)
			RETURNING customer_id, name, phone, created_at
		`, strings.TrimSpace(request.Name), request.Phone).Scan(
			&customer.ID,
			&customer.Name,
			&customer.Phone,
			&customer.CreatedAt,
		)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "Could not create customer"})
			return
		}

		writeJSON(w, http.StatusCreated, customer)
	})

	mux.HandleFunc("POST /api/laundry-orders", func(w http.ResponseWriter, r *http.Request) {
		r.Body = http.MaxBytesReader(w, r.Body, 1<<20)

		var request CreateLaundryOrderRequest
		if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{
				"error": "Invalid JSON",
			})
			return
		}

		pickupDate, err := time.Parse("2006-01-02", request.PickupDate)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{
				"error": "Invalid pickup date",
			})
			return
		}

		if request.CustomerID <= 0 || len(request.Items) == 0 {
			writeJSON(w, http.StatusBadRequest, map[string]string{
				"error": "Customer and at least one item are required",
			})
			return
		}

		var total float64
		for _, item := range request.Items {
			if strings.TrimSpace(item.ItemType) == "" ||
				item.Quantity <= 0 ||
				item.UnitPrice < 0 {
				writeJSON(w, http.StatusBadRequest, map[string]string{
					"error": "Invalid laundry item",
				})
				return
			}
			total += float64(item.Quantity) * item.UnitPrice
		}

		ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
		defer cancel()

		db, err := database.Connect(ctx)
		if err != nil {
			writeJSON(w, http.StatusServiceUnavailable, map[string]string{
				"error": "Database connection failed",
			})
			return
		}
		defer db.Close()

		tx, err := db.Begin(ctx)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{
				"error": "Could not start transaction",
			})
			return
		}
		defer tx.Rollback(ctx)

		var orderID int64
		err = tx.QueryRow(ctx, `
		INSERT INTO laundry_orders
			(customer_id, pickup_date, total_amount, notes)
		VALUES ($1, $2, $3, $4)
		RETURNING order_id
	`, request.CustomerID, pickupDate, total, strings.TrimSpace(request.Notes)).Scan(&orderID)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{
				"error": "Could not create laundry order",
			})
			return
		}

		for _, item := range request.Items {
			_, err = tx.Exec(ctx, `
			INSERT INTO laundry_order_items
				(order_id, item_type, quantity, unit_price)
			VALUES ($1, $2, $3, $4)
		`, orderID, strings.TrimSpace(item.ItemType), item.Quantity, item.UnitPrice)
			if err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]string{
					"error": "Could not save laundry items",
				})
				return
			}
		}

		if err := tx.Commit(ctx); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{
				"error": "Could not save laundry order",
			})
			return
		}

		writeJSON(w, http.StatusCreated, LaundryOrderResponse{
			OrderID:       orderID,
			CustomerID:    request.CustomerID,
			PickupDate:    pickupDate.Format("2006-01-02"),
			TotalAmount:   total,
			PaymentStatus: "unpaid",
		})
	})

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("Laundry API running at http://localhost:%s\n", port)
	log.Fatal(http.ListenAndServe(":"+port, corsMiddleware(mux)))
}

func writeJSON(w http.ResponseWriter, status int, data any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(data); err != nil {
		log.Printf("write JSON response: %v", err)
	}
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")

		if origin == "http://localhost:5173" ||
			origin == "http://localhost:5174" {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Vary", "Origin")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		}

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}
